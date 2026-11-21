import { useEffect, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Bug, ChevronDown, Eraser, FileCode2, KeyRound, PlayCircle, ShieldAlert, Sparkles, Wand2, Zap } from "lucide-react";
import { LANGUAGES, autoResolveAll, countBy, fixIssue, scanCode, type Issue, type Language, type ScanResult } from "@/lib/scanner";
import { SAMPLES } from "@/lib/scanner/samples";
import { CodeEditor, type CodeEditorHandle } from "@/components/scanner/code-editor";
import { ResultsPanel, RunButton } from "@/components/scanner/results-panel";
import { DemoDialog } from "@/components/scanner/demo-dialog";
import { ScanHistory, historyKey } from "@/components/scanner/scan-history";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { BRAND } from "@/lib/brand";

const TITLE = "CodeShield Scanner — Find & auto-fix code bugs";
const DESC = "Paste Python, JavaScript, HTML, CSS or C++ and get exact line numbers for syntax errors, logic bugs and leaked keys — with one-click auto-fix.";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESC },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESC },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ScannerPage,
});

const PATCHED_MSG = "Code patched and optimized successfully! ✨";

function ScannerPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [language, setLanguage] = useState<Language>("python");
  const [code, setCode] = useState(SAMPLES.python.buggy);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [scannedCode, setScannedCode] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [demoOpen, setDemoOpen] = useState(false);
  const [flash, setFlash] = useState<number[]>([]);
  const editorRef = useRef<CodeEditorHandle>(null);
  const workspaceRef = useRef<HTMLDivElement>(null);

  const stale = result !== null && scannedCode !== code;
  const shownIssues = result && !stale ? result.issues : [];

  useEffect(() => {
    if (!flash.length) return;
    const t = window.setTimeout(() => setFlash([]), 1400);
    return () => window.clearTimeout(t);
  }, [flash]);

  async function save(src: string, res: ScanResult) {
    if (!user) return;
    const c = countBy(res.issues);
    const { error } = await supabase.from("scans").insert({
      user_id: user.id,
      language: res.language,
      code: src,
      issue_count: res.issues.length,
      high_count: c.high,
      issues: res.issues.map(({ patches: _p, ...rest }) => rest) as never,
    });
    if (!error) qc.invalidateQueries({ queryKey: historyKey(user.id) });
  }

  function runScan() {
    if (!code.trim()) {
      toast.error("The editor is empty — paste some code first.");
      return;
    }
    setScanning(true);
    const src = code;
    window.setTimeout(() => {
      const res = scanCode(src, language);
      setResult(res);
      setScannedCode(src);
      setScanning(false);
      if (res.issues.length === 0) toast.success("All clear — pristine code! ✨");
      void save(src, res);
    }, 900);
  }

  function applyNewCode(next: string, before: string) {
    const res = scanCode(next, language);
    const a = before.split("\n");
    const b = next.split("\n");
    const changed: number[] = [];
    for (let k = 0; k < b.length; k++) if (a[k] !== b[k]) changed.push(k + 1);
    setCode(next);
    setResult(res);
    setScannedCode(next);
    setFlash(changed.slice(0, 40));
    return res;
  }

  function onFix(issue: Issue) {
    const next = fixIssue(code, issue);
    if (next === code) {
      toast.info("Nothing to change for this one.");
      return;
    }
    applyNewCode(next, code);
    toast.success(PATCHED_MSG);
  }

  function onFixAll() {
    const out = autoResolveAll(code, language);
    if (out.fixed === 0) {
      toast.info("Nothing left that can be fixed automatically.");
      return;
    }
    const res = applyNewCode(out.code, code);
    toast.success(PATCHED_MSG, {
      description: res.issues.length ? `${out.fixed} fixes applied · ${res.issues.length} need your judgement` : `${out.fixed} fixes applied · zero issues left`,
    });
    void save(out.code, res);
  }

  function switchLanguage(l: Language) {
    setLanguage(l);
    setCode(SAMPLES[l].buggy);
    setResult(null);
    setScannedCode(null);
  }

  function loadSample(kind: "buggy" | "clean") {
    setCode(SAMPLES[language][kind]);
    setResult(null);
    setScannedCode(null);
  }

  function jump(line: number) {
    editorRef.current?.focusLine(line);
    setFlash([line]);
  }

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6">
      {/* HERO */}
      <section className="relative pb-10 pt-12 text-center sm:pt-20">
        <div className="pointer-events-none absolute left-1/2 top-10 -z-10 size-72 -translate-x-1/2 rounded-full bg-gold/20 animate-pulse-glow sm:size-96" />
        <span className="pill mx-auto animate-rise border-electric/40 text-electric">
          <Zap className="size-3.5" /> Python · JS · HTML · CSS · C++
        </span>
        <h1 className="mx-auto mt-6 max-w-4xl font-display text-4xl font-black leading-[1.05] tracking-tight sm:text-6xl lg:text-7xl">
          <span className="block">
            {"Scan it.".split("").map((ch, k) => (
              <span key={k} className="kinetic-letter" style={{ animationDelay: `${k * 80}ms` }}>
                {ch === " " ? "\u00a0" : ch}
              </span>
            ))}
          </span>
          <span className="block text-gradient-neon">Shield it. Ship it.</span>
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-base text-muted-foreground sm:text-lg">
          {BRAND.name} finds syntax errors, sneaky logic bugs and leaked keys — with the exact line, a plain-English why, and a one-tap fix.
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <button
            onClick={() => workspaceRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}
            className="inline-flex items-center gap-2 rounded-2xl bg-gradient-gold px-6 py-4 font-display text-sm font-bold text-primary-foreground glow-gold transition hover:scale-105 active:scale-95"
          >
            <Sparkles className="size-4" /> Start scanning
          </button>
          <button
            onClick={() => setDemoOpen(true)}
            className="group inline-flex items-center gap-3 rounded-2xl border border-input bg-surface/60 px-5 py-3 text-sm font-semibold backdrop-blur transition hover:glow-pink"
          >
            <span className="relative flex size-9 items-center justify-center rounded-full bg-pink text-accent-foreground">
              <span className="absolute inset-0 animate-ping rounded-full bg-pink/50" />
              <PlayCircle className="relative size-5" />
            </span>
            Watch Quick Demo 🎥
          </button>
        </div>

        {/* floating feature chips */}
        <div className="mx-auto mt-12 grid max-w-3xl grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { icon: FileCode2, t: "Syntax", d: "brackets, colons, typos", c: "text-warn" },
            { icon: Bug, t: "Logic bugs", d: "= vs ==, dead code", c: "text-electric" },
            { icon: KeyRound, t: "Leaked keys", d: "API_KEY = \"…\"", c: "text-danger" },
            { icon: ShieldAlert, t: "Risky calls", d: "eval, innerHTML, gets", c: "text-pink" },
          ].map((f, k) => (
            <div key={f.t} className="glass rounded-2xl p-4 text-left animate-float" style={{ animationDelay: `${k * 0.8}s` }}>
              <f.icon className={`size-5 ${f.c}`} />
              <p className="mt-2 font-display text-sm font-bold">{f.t}</p>
              <p className="text-xs text-muted-foreground">{f.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* WORKSPACE */}
      <section ref={workspaceRef} className="scroll-mt-20">
        <div className="grid gap-5 lg:grid-cols-2">
          {/* Editor */}
          <div className="glass neon-frame overflow-hidden rounded-3xl">
            <div className="flex flex-wrap items-center gap-2 border-b border-border/60 p-3 sm:p-4">
              <div className="flex gap-1.5">
                <span className="size-3 rounded-full bg-danger" />
                <span className="size-3 rounded-full bg-warn" />
                <span className="size-3 rounded-full bg-lime" />
              </div>
              <label className="relative ml-2">
                <span className="sr-only">Language</span>
                <select
                  value={language}
                  onChange={(e) => switchLanguage(e.target.value as Language)}
                  className="appearance-none rounded-full border border-gold/50 bg-surface-2 py-1.5 pl-3 pr-8 text-sm font-semibold text-gold outline-none focus:glow-gold"
                >
                  {LANGUAGES.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.id === "javascript" ? "JS" : l.label}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 size-4 -translate-y-1/2 text-gold" />
              </label>
              <div className="ml-auto flex flex-wrap gap-1.5 text-xs">
                <button onClick={() => loadSample("buggy")} className="rounded-full border border-input px-3 py-1.5 font-semibold transition hover:border-danger hover:text-danger">
                  🐛 Buggy sample
                </button>
                <button onClick={() => loadSample("clean")} className="rounded-full border border-input px-3 py-1.5 font-semibold transition hover:border-lime hover:text-lime">
                  ✅ Clean sample
                </button>
                <button
                  onClick={() => {
                    setCode("");
                    setResult(null);
                    setScannedCode(null);
                  }}
                  aria-label="Clear editor"
                  className="rounded-full border border-input px-2.5 py-1.5 transition hover:text-foreground"
                >
                  <Eraser className="size-3.5" />
                </button>
              </div>
            </div>
            <CodeEditor ref={editorRef} value={code} onChange={setCode} issues={shownIssues} flashLines={flash} />
            <div className="flex flex-col gap-2 border-t border-border/60 p-3 sm:flex-row sm:items-center sm:p-4">
              <p className="text-xs text-muted-foreground">
                {code.split("\n").length} lines · {LANGUAGES.find((l) => l.id === language)?.label}
              </p>
              <RunButton onRun={runScan} scanning={scanning} className="sm:ml-auto" />
            </div>
          </div>

          {/* Results */}
          <div className="glass overflow-hidden rounded-3xl">
            <div className="flex items-center gap-2 border-b border-border/60 p-4">
              <Wand2 className="size-4 text-pink" />
              <p className="font-display text-sm font-bold">Security & Bug Report</p>
              {result && !scanning && (
                <span className="ml-auto pill py-0.5 text-[10px] uppercase tracking-widest">{result.lineCount} lines</span>
              )}
            </div>
            <ResultsPanel result={result} scanning={scanning} stale={stale} onRun={runScan} onFix={onFix} onFixAll={onFixAll} onJump={jump} />
          </div>
        </div>

        <ScanHistory
          onLoad={(c, l) => {
            setLanguage(l);
            setCode(c);
            setResult(null);
            setScannedCode(null);
            workspaceRef.current?.scrollIntoView({ behavior: "smooth" });
            toast.success("Scan loaded into the editor");
          }}
        />
      </section>

      <DemoDialog open={demoOpen} onOpenChange={setDemoOpen} />
    </div>
  );
}
