import { Crosshair, Loader2, Radar, RefreshCw, ShieldCheck } from "lucide-react";
import { countBy, type Issue, type ScanResult } from "@/lib/scanner";
import { cn } from "@/lib/utils";

interface Props {
  result: ScanResult | null;
  scanning: boolean;
  stale: boolean;
  onRun: () => void;
  onFix: (issue: Issue) => void;
  onFixAll: () => void;
  onJump: (line: number) => void;
}

export function badgeFor(i: Issue): { label: string; cls: string; frame: string } {
  if (i.category === "security") {
    return i.severity === "low"
      ? { label: "🔐 Security Tip", cls: "bg-pink/15 text-pink border-pink/40", frame: "glow-pink" }
      : { label: "⚡ High Risk", cls: "bg-danger/15 text-danger border-danger/50", frame: "glow-danger" };
  }
  if (i.category === "syntax") return { label: "⚠️ Syntax Bug", cls: "bg-warn/15 text-warn border-warn/50", frame: "shadow-[0_0_0_1px_var(--warn)]" };
  if (i.category === "bug") return { label: "🐞 Logic Bug", cls: "bg-electric/15 text-electric border-electric/50", frame: "glow-electric" };
  return { label: "🧹 Clean-up", cls: "bg-muted text-muted-foreground border-border", frame: "border border-border" };
}

export function RunButton({ onRun, scanning, className }: { onRun: () => void; scanning: boolean; className?: string }) {
  return (
    <button
      onClick={onRun}
      disabled={scanning}
      className={cn(
        "group relative inline-flex items-center justify-center gap-2 overflow-hidden rounded-2xl bg-gradient-gold px-6 py-4 font-display text-sm font-bold text-primary-foreground glow-gold transition-transform hover:scale-[1.03] active:scale-95 disabled:opacity-70 sm:text-base",
        className,
      )}
    >
      <span className="absolute inset-0 -translate-x-full bg-foreground/30 blur-md transition-transform duration-700 group-hover:translate-x-full" />
      {scanning ? <Loader2 className="size-5 animate-spin" /> : null}
      {scanning ? "Scanning…" : "🚀 Run AST & Multi-Lang Scan"}
    </button>
  );
}

export function ResultsPanel({ result, scanning, stale, onRun, onFix, onFixAll, onJump }: Props) {
  if (scanning) {
    return (
      <div className="flex h-full min-h-[420px] flex-col items-center justify-center gap-6 p-8 text-center">
        <div className="relative size-36">
          <div className="absolute inset-0 rounded-full border-2 border-electric/40" />
          <div className="absolute inset-4 rounded-full border border-gold/40" />
          <div className="absolute inset-0 animate-spin rounded-full border-t-2 border-gold" />
          <Radar className="absolute inset-0 m-auto size-12 text-electric animate-pulse" />
        </div>
        <div>
          <p className="font-display text-lg font-bold">Parsing your code…</p>
          <p className="mt-1 text-sm text-muted-foreground">Checking syntax, logic and security rules line by line</p>
        </div>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="flex h-full min-h-[420px] flex-col items-center justify-center gap-6 p-8 text-center">
        <div className="relative">
          <div className="absolute inset-0 rounded-full bg-gold/30 animate-pulse-glow" />
          <div className="relative flex size-24 items-center justify-center rounded-3xl border border-gold/40 bg-surface/80 animate-float">
            <Crosshair className="size-10 text-gold" />
          </div>
        </div>
        <div>
          <p className="font-display text-xl font-bold">Waiting for a scan</p>
          <p className="mx-auto mt-2 max-w-xs text-sm text-muted-foreground">
            Paste your code on the left, pick a language, then hit the big button. Results land right here.
          </p>
        </div>
        <RunButton onRun={onRun} scanning={scanning} />
      </div>
    );
  }

  const c = countBy(result.issues);
  const fixable = result.issues.filter((i) => i.patches?.length).length;

  if (result.issues.length === 0) {
    return (
      <div className="flex h-full min-h-[420px] flex-col items-center justify-center gap-5 p-8 text-center">
        <div className="relative animate-pop">
          <div className="absolute inset-0 rounded-full bg-lime/40 animate-pulse-glow" />
          <div className="relative flex size-28 items-center justify-center rounded-full bg-gradient-lime glow-lime">
            <ShieldCheck className="size-14 text-primary-foreground" />
          </div>
        </div>
        <p className="font-display text-5xl font-black text-lime animate-rise">100%</p>
        <p className="max-w-sm text-lg font-semibold text-lime animate-rise [animation-delay:120ms]">
          ✨ All Clear! Zero errors or vulnerabilities found. Your code is pristine and production-ready!
        </p>
        <p className="text-xs text-muted-foreground">
          {result.lineCount} lines checked · syntax ✓ · logic ✓ · security ✓
        </p>
        {stale && <StaleNote onRun={onRun} />}
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border/60 p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-4">
          <ScoreRing score={result.score} />
          <div className="flex-1">
            <p className="font-display text-lg font-bold">
              {result.issues.length} issue{result.issues.length === 1 ? "" : "s"} found
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5 text-xs">
              {c.security > 0 && <span className="pill border-danger/50 text-danger">⚡ {c.security} security</span>}
              {c.syntax > 0 && <span className="pill border-warn/50 text-warn">⚠️ {c.syntax} syntax</span>}
              {c.bug > 0 && <span className="pill border-electric/50 text-electric">🐞 {c.bug} logic</span>}
              {c.quality > 0 && <span className="pill">🧹 {c.quality} clean-up</span>}
            </div>
          </div>
        </div>
        {fixable > 0 && (
          <button
            onClick={onFixAll}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-neon bg-[length:200%_100%] py-3 font-display text-sm font-bold text-primary-foreground transition hover:scale-[1.01] active:scale-95 animate-shimmer"
          >
            ✨ Auto-Resolve Everything ({fixable} fixable)
          </button>
        )}
        {stale && <StaleNote onRun={onRun} />}
      </div>
      <ul className="flex-1 space-y-3 overflow-y-auto p-4 sm:max-h-[560px] sm:p-5">
        {result.issues.map((i, idx) => {
          const b = badgeFor(i);
          return (
            <li
              key={i.id}
              className={cn("glass rounded-2xl p-4 animate-rise", b.frame)}
              style={{ animationDelay: `${Math.min(idx, 10) * 50}ms` }}
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className={cn("pill border", b.cls)}>{b.label}</span>
                <button onClick={() => onJump(i.line)} className="pill font-mono hover:border-gold hover:text-gold" title="Show this line in the editor">
                  Line {i.line}
                </button>
              </div>
              <p className="mt-3 font-semibold">{i.title}</p>
              <p className="mt-1 text-sm text-muted-foreground">{i.message}</p>
              <p className="mt-2 rounded-lg bg-editor/70 px-3 py-2 text-xs text-foreground/90">
                <span className="font-semibold text-lime">💡 Fix: </span>
                {i.suggestion}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {i.patches?.length ? (
                  <button
                    onClick={() => onFix(i)}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-gold px-3.5 py-2 text-xs font-bold text-primary-foreground transition hover:scale-105 active:scale-95"
                  >
                    ✨ Auto-Resolve / Fix Code
                  </button>
                ) : (
                  <span className="text-xs text-muted-foreground">Needs a human decision — follow the tip above.</span>
                )}
                <button
                  onClick={() => onJump(i.line)}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-input px-3 py-2 text-xs font-semibold transition hover:border-electric hover:text-electric"
                >
                  <Crosshair className="size-3.5" /> Show line
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function StaleNote({ onRun }: { onRun: () => void }) {
  return (
    <button onClick={onRun} className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-electric/50 bg-electric/10 py-2 text-xs font-semibold text-electric">
      <RefreshCw className="size-3.5" /> Code changed — tap to re-scan
    </button>
  );
}

function ScoreRing({ score }: { score: number }) {
  const r = 26;
  const circ = 2 * Math.PI * r;
  const tone = score >= 80 ? "text-lime" : score >= 50 ? "text-warn" : "text-danger";
  return (
    <div className="relative size-16 shrink-0">
      <svg viewBox="0 0 64 64" className="size-16 -rotate-90">
        <circle cx="32" cy="32" r={r} fill="none" stroke="currentColor" strokeWidth="6" className="text-muted" />
        <circle
          cx="32"
          cy="32"
          r={r}
          fill="none"
          stroke="currentColor"
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={circ - (score / 100) * circ}
          className={cn(tone, "transition-all duration-700")}
        />
      </svg>
      <span className={cn("absolute inset-0 flex flex-col items-center justify-center font-display text-sm font-bold", tone)}>
        {score}
        <span className="text-[8px] font-normal uppercase text-muted-foreground">health</span>
      </span>
    </div>
  );
}
