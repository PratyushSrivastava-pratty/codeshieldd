import { forwardRef, useImperativeHandle, useRef, useState } from "react";
import type { Issue } from "@/lib/scanner";
import { cn } from "@/lib/utils";

const LINE_H = 22;
const PAD = 16;

export interface CodeEditorHandle {
  focusLine: (line: number) => void;
}

interface Props {
  value: string;
  onChange: (v: string) => void;
  issues: Issue[];
  flashLines?: number[];
}

/** Lightweight code editor: textarea + synced line gutter + issue-line highlights. */
export const CodeEditor = forwardRef<CodeEditorHandle, Props>(function CodeEditor({ value, onChange, issues, flashLines = [] }, ref) {
  const taRef = useRef<HTMLTextAreaElement>(null);
  const [scroll, setScroll] = useState({ top: 0, left: 0 });
  const lines = value.split("\n");
  const sevByLine = new Map<number, "high" | "other">();
  for (const i of issues) {
    if (i.severity === "high" || i.category === "security") sevByLine.set(i.line, "high");
    else if (!sevByLine.has(i.line)) sevByLine.set(i.line, "other");
  }

  useImperativeHandle(ref, () => ({
    focusLine(line: number) {
      const ta = taRef.current;
      if (!ta) return;
      const all = ta.value.split("\n");
      let start = 0;
      for (let k = 0; k < line - 1 && k < all.length; k++) start += (all[k]?.length ?? 0) + 1;
      const end = start + (all[line - 1]?.length ?? 0);
      ta.focus();
      ta.setSelectionRange(start, end);
      ta.scrollTop = Math.max(0, (line - 4) * LINE_H);
    },
  }));

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Tab") {
      e.preventDefault();
      const ta = e.currentTarget;
      const { selectionStart: s, selectionEnd: en } = ta;
      const next = value.slice(0, s) + "    " + value.slice(en);
      onChange(next);
      requestAnimationFrame(() => ta.setSelectionRange(s + 4, s + 4));
    }
  }

  return (
    <div className="relative flex h-[420px] overflow-hidden bg-editor sm:h-[520px]">
      {/* Gutter */}
      <div className="relative w-12 shrink-0 select-none overflow-hidden border-r border-border/60 bg-surface/40 text-right">
        <div style={{ transform: `translateY(${-scroll.top}px)`, paddingTop: PAD }}>
          {lines.map((_, k) => {
            const sev = sevByLine.get(k + 1);
            return (
              <div
                key={k}
                className={cn(
                  "code-font relative pr-2 text-muted-foreground/60",
                  sev === "high" && "font-bold text-danger",
                  sev === "other" && "font-bold text-warn",
                )}
                style={{ height: LINE_H }}
              >
                {sev ? <span className={cn("absolute left-1.5 top-[8px] size-1.5 rounded-full", sev === "high" ? "bg-danger" : "bg-warn")} /> : null}
                {k + 1}
              </div>
            );
          })}
        </div>
      </div>

      {/* Code area */}
      <div className="relative flex-1 overflow-hidden">
        <div aria-hidden className="pointer-events-none absolute inset-0" style={{ transform: `translateY(${-scroll.top}px)` }}>
          {[...sevByLine.entries()].map(([line, sev]) => (
            <div
              key={`i${line}`}
              className={cn("absolute inset-x-0 border-l-2", sev === "high" ? "border-danger bg-danger/10" : "border-warn bg-warn/10")}
              style={{ top: PAD + (line - 1) * LINE_H, height: LINE_H }}
            />
          ))}
          {flashLines.map((line) => (
            <div
              key={`f${line}`}
              className="absolute inset-x-0 animate-pulse border-l-2 border-lime bg-lime/15"
              style={{ top: PAD + (line - 1) * LINE_H, height: LINE_H }}
            />
          ))}
        </div>
        <textarea
          ref={taRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={onKeyDown}
          onScroll={(e) => setScroll({ top: e.currentTarget.scrollTop, left: e.currentTarget.scrollLeft })}
          spellCheck={false}
          autoCapitalize="off"
          autoComplete="off"
          autoCorrect="off"
          wrap="off"
          aria-label="Code editor"
          placeholder="// Paste or type your code here…"
          className="code-font relative h-full w-full resize-none overflow-auto whitespace-pre bg-transparent text-foreground caret-gold outline-none placeholder:text-muted-foreground/50"
          style={{ padding: PAD, paddingLeft: 12 }}
        />
      </div>
    </div>
  );
});
