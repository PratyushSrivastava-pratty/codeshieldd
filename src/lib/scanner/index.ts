import { applyPatches } from "./patch";
import { scanPython } from "./python";
import { scanJavaScript } from "./javascript";
import { scanHtml } from "./html";
import { scanCss } from "./css";
import { scanCpp } from "./cpp";
import type { Issue, Language, ScanResult } from "./types";

export * from "./types";
export { applyPatches };

const WEIGHT: Record<string, number> = { "security:high": 22, "security:medium": 12, "security:low": 6, syntax: 15, bug: 10, quality: 4 };
const PRIORITY: Record<string, number> = {
  "unclosed-string": 0,
  "unclosed-comment": 0,
  "unknown-tag": 1,
  typo: 1,
  "missing-open-brace": 1,
  "else-if": 1,
  "unclosed-bracket": 2,
  "stray-bracket": 2,
  "unclosed-tag": 2,
  "stray-closing-tag": 2,
};

function weight(i: Issue): number {
  return i.category === "security" ? (WEIGHT[`security:${i.severity}`] ?? 10) : (WEIGHT[i.category] ?? 5);
}

const RANK: Record<string, number> = { security: 0, syntax: 1, bug: 2, quality: 3 };

export function normalizeCode(code: string): string {
  return code.replace(/\r\n?/g, "\n");
}

export function scanCode(code: string, language: Language): ScanResult {
  const src = normalizeCode(code);
  let issues: Issue[];
  switch (language) {
    case "python":
      issues = scanPython(src);
      break;
    case "javascript":
      issues = scanJavaScript(src);
      break;
    case "html":
      issues = scanHtml(src);
      break;
    case "css":
      issues = scanCss(src);
      break;
    case "cpp":
      issues = scanCpp(src);
      break;
  }
  issues.sort((a, b) => a.line - b.line || (RANK[a.category] ?? 9) - (RANK[b.category] ?? 9) || a.column - b.column);
  const score = Math.max(0, 100 - issues.reduce((s, i) => s + weight(i), 0));
  return { language, issues, score, lineCount: src.split("\n").length };
}

export function fixIssue(code: string, issue: Issue): string {
  return applyPatches(normalizeCode(code), issue.patches ?? []);
}

/** Repeatedly applies the highest-priority fix and re-scans until nothing fixable is left. */
export function autoResolveAll(code: string, language: Language, maxSteps = 120): { code: string; fixed: number; result: ScanResult } {
  let current = normalizeCode(code);
  let fixed = 0;
  const seen = new Set<string>([current]);
  for (let step = 0; step < maxSteps; step++) {
    const res = scanCode(current, language);
    const fixable = res.issues
      .filter((i) => i.patches && i.patches.length)
      .sort((a, b) => (PRIORITY[a.rule] ?? 5) - (PRIORITY[b.rule] ?? 5) || a.line - b.line);
    let progressed = false;
    for (const candidate of fixable) {
      const next = applyPatches(current, candidate.patches ?? []);
      if (next !== current && !seen.has(next)) {
        seen.add(next);
        current = next;
        fixed++;
        progressed = true;
        break;
      }
    }
    if (!progressed) break;
  }
  return { code: current, fixed, result: scanCode(current, language) };
}

export function countBy(issues: Issue[]) {
  return {
    security: issues.filter((i) => i.category === "security").length,
    syntax: issues.filter((i) => i.category === "syntax").length,
    bug: issues.filter((i) => i.category === "bug").length,
    quality: issues.filter((i) => i.category === "quality").length,
    high: issues.filter((i) => i.severity === "high").length,
  };
}
