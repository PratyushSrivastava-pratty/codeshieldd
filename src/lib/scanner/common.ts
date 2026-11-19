import type { Unterminated } from "./tokenize";
import { Ctx, indentOf, indentWidth, toEnvName } from "./util";
import type { Patch } from "./types";

const PAIRS: Record<string, string> = { "(": ")", "[": "]", "{": "}" };
const CLOSERS: Record<string, string> = { ")": "(", "]": "[", "}": "{" };
const NAMES: Record<string, string> = {
  "(": "parenthesis",
  "[": "square bracket",
  "{": "curly brace",
  ")": "parenthesis",
  "]": "square bracket",
  "}": "curly brace",
};

/** Where to insert a missing closing quote/bracket: before trailing `);,]}:{` */
function closingInsertPoint(content: string, minCol: number, trailing: string): number {
  let k = content.length;
  while (k > minCol && trailing.includes(content[k - 1] ?? "")) k--;
  while (k > minCol && content[k - 1] === " ") k--;
  return Math.max(k, minCol);
}

export function checkUnterminated(ctx: Ctx, list: Unterminated[]) {
  for (const u of list) {
    if (u.kind === "comment") {
      const closer = u.quote === "<!--" ? "-->" : "*/";
      ctx.add({
        rule: "unclosed-comment",
        line: u.line,
        column: u.col,
        category: "syntax",
        severity: "high",
        title: "Comment never closed",
        message: `A comment opened with ${u.quote} on line ${u.line} is never closed, so everything after it is silently ignored.`,
        suggestion: `Close the comment with ${closer}.`,
        patches: [{ op: "insert", line: ctx.lineCount + 1, text: closer }],
      });
    } else if (u.kind === "longstring") {
      const last = ctx.lineCount;
      ctx.add({
        rule: "unclosed-string",
        line: u.line,
        column: u.col,
        category: "syntax",
        severity: "high",
        title: "Multi-line string never closed",
        message: `The string that starts with ${u.quote} on line ${u.line} never ends, so the rest of the file is swallowed into it.`,
        suggestion: `Add the closing ${u.quote}.`,
        patches: [{ op: "replace", line: last, text: ctx.line(last) + u.quote }],
      });
    } else {
      const raw = ctx.line(u.line);
      const content = raw.replace(/\s+$/, "");
      const at = closingInsertPoint(content, u.col + 1, ctx.lang === "css" ? ";" : ");,]}");
      ctx.add({
        rule: "unclosed-string",
        line: u.line,
        column: u.col,
        category: "syntax",
        severity: "high",
        title: "Unterminated string",
        message: `The text that starts with ${u.quote} is never closed on this line, which breaks everything after it.`,
        suggestion: `Close the string with a matching ${u.quote}.`,
        patches: [ctx.insertAt(u.line, at, u.quote)],
      });
    }
  }
}

/** Patch that closes an unclosed opener using a best-guess location. */
function closeOpenerPatch(ctx: Ctx, line: number, col: number, ch: string): Patch {
  const closer = PAIRS[ch] ?? ")";
  const m = ctx.mline(line);
  const content = m.replace(/\s+$/, "");
  const openerIsLast = content.length - 1 === col;
  if (ch !== "{" && !openerIsLast) {
    const at = closingInsertPoint(content, col + 1, ";:{,");
    return ctx.insertAt(line, at, closer);
  }
  // Block-ish: close it where the indentation drops back.
  const ind = indentWidth(ctx.line(line));
  for (let k = line + 1; k <= ctx.lineCount; k++) {
    const mk = ctx.mline(k);
    if (mk.trim() === "") continue;
    if (indentWidth(ctx.line(k)) <= ind) {
      return { op: "insert", line: k, text: indentOf(ctx.line(line)) + closer };
    }
  }
  let lastCode = ctx.lineCount;
  while (lastCode > line && ctx.mline(lastCode).trim() === "") lastCode--;
  return { op: "insert", line: lastCode + 1, text: indentOf(ctx.line(line)) + closer };
}

export function checkBrackets(ctx: Ctx, masked: string, skipLines: Set<number>) {
  const stack: { ch: string; line: number; col: number }[] = [];
  let line = 1;
  let col = 0;
  for (let i = 0; i < masked.length; i++) {
    const c = masked[i] ?? "";
    if (c === "\n") {
      line++;
      col = 0;
      continue;
    }
    if (PAIRS[c]) stack.push({ ch: c, line, col });
    else if (CLOSERS[c]) {
      const want = CLOSERS[c];
      const top = stack[stack.length - 1];
      if (top && top.ch === want) stack.pop();
      else {
        let deeper = -1;
        for (let k = stack.length - 1; k >= 0; k--) if (stack[k]?.ch === want) { deeper = k; break; }
        if (deeper >= 0) {
          while (stack.length - 1 > deeper) {
            const u = stack.pop();
            if (!u || skipLines.has(u.line)) continue;
            const closer = PAIRS[u.ch] ?? "";
            const sameLine = u.line === line;
            ctx.add({
              rule: "unclosed-bracket",
              line: u.line,
              column: u.col,
              category: "syntax",
              severity: "high",
              title: `Unclosed ${NAMES[u.ch]} "${u.ch}"`,
              message: `The "${u.ch}" opened here is never closed before the "${c}" on line ${line}.`,
              suggestion: `Add the missing "${closer}".`,
              patches: [sameLine ? ctx.insertAt(line, col, closer) : closeOpenerPatch(ctx, u.line, u.col, u.ch)],
            });
          }
          stack.pop();
        } else if (!skipLines.has(line)) {
          const raw = ctx.line(line);
          const without = raw.slice(0, col) + raw.slice(col + 1);
          ctx.add({
            rule: "stray-bracket",
            line,
            column: col,
            category: "syntax",
            severity: "high",
            title: `Unexpected "${c}"`,
            message: `This closing ${NAMES[c]} has no matching "${want}" before it.`,
            suggestion: `Remove the extra "${c}" or add the missing "${want}".`,
            patches: [without.trim() === "" ? { op: "delete", line } : { op: "replace", line, text: without }],
          });
        }
      }
    }
    col++;
  }
  for (const u of stack) {
    if (skipLines.has(u.line)) continue;
    const closer = PAIRS[u.ch] ?? "";
    ctx.add({
      rule: "unclosed-bracket",
      line: u.line,
      column: u.col,
      category: "syntax",
      severity: "high",
      title: `Unclosed ${NAMES[u.ch]} "${u.ch}"`,
      message: `The "${u.ch}" opened here is never closed, so the code after it can't be understood.`,
      suggestion: `Add the missing "${closer}".`,
      patches: [closeOpenerPatch(ctx, u.line, u.col, u.ch)],
    });
  }
}

const SECRET_NAME =
  /(?<![\w$])((?:[A-Za-z_$][\w$-]*?)?(?:key|secret|token|password|passwd|pwd|credential|auth)[\w$-]*)\b\s*(?:=|:)\s*(["'`])([^"'`\n]{4,})\2/gi;
const SECRET_PATTERNS: [RegExp, string][] = [
  [/AKIA[0-9A-Z]{16}/, "AWS access key"],
  [/\bsk-[A-Za-z0-9_-]{20,}/, "secret API key"],
  [/\bgh[pousr]_[A-Za-z0-9]{30,}/, "GitHub token"],
  [/\bAIza[0-9A-Za-z_-]{30,}/, "Google API key"],
  [/\bxox[baprs]-[A-Za-z0-9-]{10,}/, "Slack token"],
  [/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/, "private key"],
];
const PLACEHOLDER = /^(?:<.*>|\$\{.*\}|x+|\*+|\.\.\.|your[-_ ].*|REDACTED|changeme_?placeholder)$/i;

function secretReplacement(ctx: Ctx, name: string): { text: string; extra: Patch[] } {
  const env = toEnvName(name) || "SECRET_KEY";
  switch (ctx.lang) {
    case "python": {
      const hasOs = ctx.lines.some((l) => /^\s*import\s+os\b|^\s*from\s+os\s+import/.test(l));
      return { text: `os.environ.get("${env}")`, extra: hasOs ? [] : [{ op: "insert", line: 1, text: "import os" }] };
    }
    case "javascript":
      return { text: `process.env.${env}`, extra: [] };
    case "cpp": {
      const has = ctx.lines.some((l) => /#include\s*<(cstdlib|stdlib\.h|bits\/stdc\+\+\.h)>/.test(l));
      return { text: `std::getenv("${env}")`, extra: has ? [] : [{ op: "insert", line: 1, text: "#include <cstdlib>" }] };
    }
    default:
      return { text: `"REDACTED"`, extra: [] };
  }
}

export function checkSecrets(ctx: Ctx, lineOffset = 0) {
  ctx.lines.forEach((raw, idx) => {
    const n = idx + 1;
    let flagged = false;
    for (const m of raw.matchAll(SECRET_NAME)) {
      const [whole, name = "", , value = ""] = m;
      if (PLACEHOLDER.test(value.trim()) || /process\.env|os\.environ|getenv/.test(value)) continue;
      if (/^(true|false|null|none)$/i.test(value)) continue;
      const start = (m.index ?? 0) + whole.length - value.length - 2;
      const { text, extra } = secretReplacement(ctx, name);
      ctx.add({
        rule: "hardcoded-secret",
        line: n,
        column: m.index ?? 0,
        category: "security",
        severity: "high",
        title: "Hardcoded secret key",
        message: `"${name}" is set to a secret written directly in the code. Anyone who sees this file (or your GitHub repo) can steal and abuse it.`,
        suggestion: "Load secrets from environment variables or a secret manager — never commit them.",
        patches: [ctx.replaceRange(n, start, value.length + 2, text), ...extra],
      });
      flagged = true;
      break;
    }
    if (flagged) return;
    for (const [re, label] of SECRET_PATTERNS) {
      const m = re.exec(raw);
      if (!m) continue;
      const before = raw.slice(0, m.index);
      const q = /["'`]$/.exec(before)?.[0];
      const after = raw.slice(m.index + m[0].length);
      const quoted = q && after.startsWith(q);
      const patches: Patch[] = [];
      if (quoted) {
        const { text, extra } = secretReplacement(ctx, label);
        patches.push(ctx.replaceRange(n, m.index - 1, m[0].length + 2, text), ...extra);
      } else {
        patches.push(ctx.replaceRange(n, m.index, m[0].length, "REDACTED"));
      }
      ctx.add({
        rule: "hardcoded-secret",
        line: n,
        column: m.index,
        category: "security",
        severity: "high",
        title: `Leaked ${label}`,
        message: `This line contains what looks like a real ${label}. Bots scan public code for these within minutes.`,
        suggestion: "Revoke this key, then load it from an environment variable instead.",
        patches,
      });
      break;
    }
  });
  void lineOffset;
}

export function typoCheck(
  ctx: Ctx,
  dict: Record<string, string>,
  opts: { requireNext?: Record<string, RegExp> } = {},
) {
  const words = Object.keys(dict);
  if (!words.length) return;
  const re = new RegExp(`(?<![\\w$])(${words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})(?![\\w$])`, "g");
  ctx.mlines.forEach((m, idx) => {
    const n = idx + 1;
    for (const hit of m.matchAll(re)) {
      const w = hit[1] ?? "";
      const fix = dict[w];
      if (!fix) continue;
      const need = opts.requireNext?.[w];
      if (need && !need.test(m.slice((hit.index ?? 0) + w.length))) continue;
      ctx.add({
        rule: "typo",
        line: n,
        column: hit.index ?? 0,
        category: "syntax",
        severity: "high",
        title: `Typo: "${w}"`,
        message: `"${w}" isn't something the ${langName(ctx)} interpreter knows. You almost certainly meant "${fix}".`,
        suggestion: `Replace "${w}" with "${fix}".`,
        patches: [ctx.replaceRange(n, hit.index ?? 0, w.length, fix)],
      });
    }
  });
}

export function langName(ctx: Ctx): string {
  return { python: "Python", javascript: "JavaScript", html: "HTML", css: "CSS", cpp: "C++" }[ctx.lang];
}
