import type { Patch } from "./types";

const opOrder = (p: Patch) => (p.op === "insert" ? 1 : 0);

export function applyPatches(code: string, patches: Patch[]): string {
  const lines = code.split("\n");
  const sorted = [...patches].sort((a, b) => b.line - a.line || opOrder(a) - opOrder(b));
  for (const p of sorted) {
    const idx = p.line - 1;
    if (p.op === "replace") {
      if (idx >= 0 && idx < lines.length) lines[idx] = p.text;
    } else if (p.op === "delete") {
      if (idx >= 0 && idx < lines.length) lines.splice(idx, 1);
    } else {
      lines.splice(Math.max(0, Math.min(idx, lines.length)), 0, p.text);
    }
  }
  return lines.join("\n");
}
