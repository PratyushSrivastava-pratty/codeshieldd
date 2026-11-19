import type { Issue, Language, Patch } from "./types";

export class Ctx {
  issues: Issue[] = [];
  private seen = new Set<string>();
  constructor(
    public lines: string[],
    public mlines: string[],
    public lang: Language,
  ) {}

  add(i: Omit<Issue, "id">) {
    const key = `${i.rule}:${i.line}:${i.column}`;
    if (this.seen.has(key)) return;
    this.seen.add(key);
    const issue: Issue = { ...i, id: key };
    if (i.patches && i.patches.length === 0) delete issue.patches;
    this.issues.push(issue);
  }

  line(n: number): string {
    return this.lines[n - 1] ?? "";
  }
  mline(n: number): string {
    return this.mlines[n - 1] ?? "";
  }
  /** Length of the line without trailing comment / whitespace */
  contentEnd(n: number): number {
    return this.mline(n).replace(/\s+$/, "").length;
  }
  replaceRange(n: number, col: number, len: number, text: string): Patch {
    const l = this.line(n);
    return { op: "replace", line: n, text: l.slice(0, col) + text + l.slice(col + len) };
  }
  insertAt(n: number, col: number, text: string): Patch {
    return this.replaceRange(n, col, 0, text);
  }
  appendToContent(n: number, text: string): Patch {
    return this.insertAt(n, this.contentEnd(n), text);
  }
  /** Next non-blank (masked) line number after n, or -1 */
  nextCodeLine(n: number): number {
    for (let k = n + 1; k <= this.mlines.length; k++) if (this.mline(k).trim() !== "") return k;
    return -1;
  }
  prevCodeLine(n: number): number {
    for (let k = n - 1; k >= 1; k--) if (this.mline(k).trim() !== "") return k;
    return -1;
  }
  get lineCount() {
    return this.lines.length;
  }
}

export function indentOf(s: string): string {
  return /^[ \t]*/.exec(s)?.[0] ?? "";
}

export function indentWidth(s: string): number {
  let w = 0;
  for (const c of indentOf(s)) w += c === "\t" ? 4 : 1;
  return w;
}

/** Optimal-string-alignment distance (Levenshtein + adjacent transpositions). */
export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  const m = a.length;
  const n = b.length;
  if (!m) return n;
  if (!n) return m;
  const d: number[][] = Array.from({ length: m + 1 }, (_, i) => Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)));
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      const row = d[i]!;
      const prev = d[i - 1]!;
      let v = Math.min(prev[j]! + 1, row[j - 1]! + 1, prev[j - 1]! + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, d[i - 2]![j - 2]! + 1);
      row[j] = v;
    }
  }
  return d[m]![n]!;
}

export function closest(word: string, candidates: Iterable<string>, maxDist = 2): string | null {
  let best: string | null = null;
  let bestD = Infinity;
  for (const c of candidates) {
    if (Math.abs(c.length - word.length) > maxDist) continue;
    const d = levenshtein(word, c);
    if (d < bestD) {
      bestD = d;
      best = c;
    }
  }
  if (best === null || bestD > maxDist) return null;
  // Short words need a tighter match to avoid silly suggestions
  if (word.length <= 3 && bestD > 1) return null;
  return best;
}

/** Depth of ( [ { at the start and end of every line in masked text. */
export function lineDepths(masked: string): { start: number[]; end: number[] } {
  const start: number[] = [0];
  const end: number[] = [];
  let depth = 0;
  for (const c of masked) {
    if (c === "\n") {
      end.push(depth);
      start.push(depth);
    } else if (c === "(" || c === "[" || c === "{") depth++;
    else if (c === ")" || c === "]" || c === "}") depth = Math.max(0, depth - 1);
  }
  end.push(depth);
  return { start, end };
}

/** Index of the paren matching the one at `open` within a single string, or -1 */
export function matchParen(s: string, open: number): number {
  let d = 0;
  for (let k = open; k < s.length; k++) {
    const c = s[k];
    if (c === "(") d++;
    else if (c === ")") {
      d--;
      if (d === 0) return k;
    }
  }
  return -1;
}

export function toEnvName(name: string): string {
  return name
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/[^A-Za-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toUpperCase();
}

export function regexAll(re: RegExp, s: string): RegExpExecArray[] {
  const g = new RegExp(re.source, re.flags.includes("g") ? re.flags : re.flags + "g");
  const res: RegExpExecArray[] = [];
  let m: RegExpExecArray | null;
  while ((m = g.exec(s))) {
    res.push(m);
    if (m[0] === "") g.lastIndex++;
  }
  return res;
}
