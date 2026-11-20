import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Pause, Play, RotateCcw, ShieldCheck, Volume2, VolumeX } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { BRAND, DEMO_CLIPS } from "@/lib/brand";
import { cn } from "@/lib/utils";

const SCENES = [
  { title: "Welcome to CodeShield", caption: "Your neon security sidekick for Python, JavaScript, HTML, CSS and C++." },
  { title: "1 · Paste your code", caption: "Drop your code into the editor and pick its language from the dropdown." },
  { title: "2 · Run the scan", caption: "Hit “🚀 Run AST & Multi-Lang Scan” — every line gets checked in a blink." },
  { title: "3 · Read the report", caption: "Each problem shows its exact line, a risk badge and a plain-English explanation." },
  { title: "4 · Auto-resolve", caption: "Tap “✨ Auto-Resolve” and the fix lands in your editor instantly. All clear!" },
];
const FALLBACK_MS = 7000;

const BUGGY = [
  { t: 'API_KEY = "sk-live-9f8a…"', bad: "high" },
  { t: "def total(prices)", bad: "syntax" },
  { t: "    return sum(prices)", bad: null },
  { t: "result = eval(user_input)", bad: "high" },
  { t: "if result = 10:", bad: "syntax" },
] as const;
const FIXED = ['API_KEY = os.environ.get("API_KEY")', "def total(prices):", "    return sum(prices)", "result = ast.literal_eval(user_input)", "if result == 10:"];

export function DemoDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const [scene, setScene] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [muted, setMuted] = useState(false);
  const [progress, setProgress] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const timerRef = useRef<number | null>(null);
  const lastSceneRef = useRef<number>(-1);

  // Reset when opened
  useEffect(() => {
    if (open) {
      lastSceneRef.current = -1;
      setScene(0);
      setPlaying(true);
    } else {
      audioRef.current?.pause();
    }
  }, [open]);

  // Drive audio per scene
  useEffect(() => {
    if (!open) return;
    const audio = audioRef.current ?? new Audio();
    audioRef.current = audio;
    const src = DEMO_CLIPS[scene] ?? "";
    if (lastSceneRef.current !== scene || !audio.src.endsWith(src)) {
      audio.src = src;
      audio.currentTime = 0;
      setProgress(0);
      lastSceneRef.current = scene;
    }
    audio.muted = muted;

    const advance = () => {
      if (scene < SCENES.length - 1) setScene((s) => s + 1);
      else setPlaying(false);
    };
    const onTime = () => audio.duration && setProgress(audio.currentTime / audio.duration);
    audio.addEventListener("ended", advance);
    audio.addEventListener("timeupdate", onTime);

    let fallbackStart = 0;
    const startFallback = () => {
      fallbackStart = performance.now();
      const tick = () => {
        const p = (performance.now() - fallbackStart) / FALLBACK_MS;
        setProgress(Math.min(1, p));
        if (p >= 1) advance();
        else timerRef.current = requestAnimationFrame(tick);
      };
      timerRef.current = requestAnimationFrame(tick);
    };

    if (playing) {
      audio.play().catch(() => startFallback());
    }
    return () => {
      audio.pause();
      audio.removeEventListener("ended", advance);
      audio.removeEventListener("timeupdate", onTime);
      if (timerRef.current) cancelAnimationFrame(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene, open, playing]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.muted = muted;
  }, [muted]);

  const done = !playing && scene === SCENES.length - 1 && progress >= 0.99;
  const s = SCENES[scene]!;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass neon-frame max-w-3xl gap-0 overflow-hidden rounded-3xl border-0 p-0 sm:rounded-3xl">
        <DialogTitle className="sr-only">CodeShield quick demo</DialogTitle>
        <DialogDescription className="sr-only">A narrated walkthrough of scanning and fixing code.</DialogDescription>

        {/* Stage */}
        <div className="relative aspect-video w-full overflow-hidden bg-editor">
          <div className="starfield absolute inset-0 opacity-60" />
          <div className="cyber-grid absolute inset-0" />
          <div key={scene} className="absolute inset-0 flex items-center justify-center p-4 sm:p-8">
            {scene === 0 && <SceneWelcome />}
            {scene === 1 && <SceneCode mode="type" />}
            {scene === 2 && <SceneCode mode="scan" />}
            {scene === 3 && <SceneReport />}
            {scene === 4 && <SceneFix />}
          </div>
          <div className="absolute left-3 top-3 pill bg-background/70 text-[10px] uppercase tracking-widest">
            <span className="size-1.5 rounded-full bg-danger animate-pulse" /> Demo · {scene + 1}/{SCENES.length}
          </div>
        </div>

        {/* Caption + controls */}
        <div className="space-y-3 p-4 sm:p-5">
          <div key={`c${scene}`} className="animate-rise">
            <p className="font-display text-lg font-bold">{s.title}</p>
            <p className="text-sm text-muted-foreground">{s.caption}</p>
          </div>
          <div className="flex gap-1.5">
            {SCENES.map((_, k) => (
              <button
                key={k}
                onClick={() => {
                  setScene(k);
                  setPlaying(true);
                }}
                aria-label={`Go to step ${k + 1}`}
                className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted"
              >
                <span
                  className="block h-full bg-gradient-gold"
                  style={{ width: k < scene ? "100%" : k === scene ? `${progress * 100}%` : "0%" }}
                />
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <CtrlBtn label="Previous step" disabled={scene === 0} onClick={() => setScene((x) => Math.max(0, x - 1))}>
              <ChevronLeft className="size-4" />
            </CtrlBtn>
            {done ? (
              <CtrlBtn
                label="Replay"
                primary
                onClick={() => {
                  setScene(0);
                  setPlaying(true);
                }}
              >
                <RotateCcw className="size-4" />
              </CtrlBtn>
            ) : (
              <CtrlBtn label={playing ? "Pause" : "Play"} primary onClick={() => setPlaying((p) => !p)}>
                {playing ? <Pause className="size-4" /> : <Play className="size-4" />}
              </CtrlBtn>
            )}
            <CtrlBtn
              label="Next step"
              disabled={scene === SCENES.length - 1}
              onClick={() => setScene((x) => Math.min(SCENES.length - 1, x + 1))}
            >
              <ChevronRight className="size-4" />
            </CtrlBtn>
            <CtrlBtn label={muted ? "Unmute" : "Mute"} onClick={() => setMuted((m) => !m)}>
              {muted ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
            </CtrlBtn>
            <button
              onClick={() => onOpenChange(false)}
              className="ml-auto rounded-xl bg-gradient-gold px-4 py-2 text-sm font-bold text-primary-foreground transition hover:scale-105 active:scale-95"
            >
              Try it now →
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function CtrlBtn({ children, label, onClick, disabled, primary }: { children: React.ReactNode; label: string; onClick: () => void; disabled?: boolean; primary?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={cn(
        "flex size-10 items-center justify-center rounded-full border border-input transition active:scale-90 disabled:opacity-30",
        primary ? "bg-surface-2 text-gold glow-gold" : "hover:border-electric hover:text-electric",
      )}
    >
      {children}
    </button>
  );
}

function SceneWelcome() {
  return (
    <div className="relative flex flex-col items-center text-center">
      <div className="absolute size-48 rounded-full border border-gold/30 animate-spin-slow sm:size-64">
        <span className="absolute -top-1.5 left-1/2 size-3 rounded-full bg-gold glow-gold" />
      </div>
      <div className="absolute size-64 rounded-full border border-electric/20 animate-spin-slow [animation-direction:reverse] sm:size-80">
        <span className="absolute -bottom-1.5 left-1/2 size-3 rounded-full bg-electric glow-electric" />
      </div>
      <img src={BRAND.emblemUrl} alt="" className="relative size-24 object-contain animate-pop drop-shadow-[0_0_30px_var(--gold)] sm:size-32" />
      <p className="relative mt-4 font-display text-2xl font-black text-gradient-neon animate-rise sm:text-4xl">CodeShield</p>
      <p className="relative mt-1 text-xs text-muted-foreground animate-rise [animation-delay:200ms] sm:text-sm">{BRAND.tagline}</p>
    </div>
  );
}

function MiniEditor({ children, lang = "Python" }: { children: React.ReactNode; lang?: string }) {
  return (
    <div className="w-full max-w-md overflow-hidden rounded-2xl border border-border bg-surface/90 shadow-2xl animate-pop">
      <div className="flex items-center gap-1.5 border-b border-border px-3 py-2">
        <span className="size-2.5 rounded-full bg-danger" />
        <span className="size-2.5 rounded-full bg-warn" />
        <span className="size-2.5 rounded-full bg-lime" />
        <span className="ml-auto pill py-0.5 text-[10px] text-gold">{lang} ▾</span>
      </div>
      <div className="relative p-3 font-mono text-[10px] leading-5 sm:text-xs sm:leading-6">{children}</div>
    </div>
  );
}

function SceneCode({ mode }: { mode: "type" | "scan" }) {
  return (
    <div className="flex w-full flex-col items-center gap-3">
      <MiniEditor>
        {BUGGY.map((l, k) => (
          <div
            key={k}
            className={cn("flex gap-3 overflow-hidden whitespace-nowrap", mode === "type" && "animate-rise")}
            style={mode === "type" ? { animationDelay: `${k * 450}ms` } : undefined}
          >
            <span className="w-4 text-right text-muted-foreground/50">{k + 1}</span>
            <span>{l.t}</span>
          </div>
        ))}
        {mode === "scan" && <div className="pointer-events-none absolute inset-x-0 top-0 h-8 bg-gradient-to-b from-transparent via-electric/40 to-transparent animate-scan" />}
      </MiniEditor>
      {mode === "scan" && (
        <div className="rounded-xl bg-gradient-gold px-4 py-2 font-display text-[10px] font-bold text-primary-foreground glow-gold animate-pulse sm:text-xs">
          🚀 Run AST & Multi-Lang Scan
        </div>
      )}
    </div>
  );
}

function SceneReport() {
  const cards = [
    { line: 1, b: "⚡ High Risk", cls: "border-danger/60 text-danger", t: "Hardcoded secret key" },
    { line: 2, b: "⚠️ Syntax Bug", cls: "border-warn/60 text-warn", t: "Missing colon after def" },
    { line: 4, b: "⚡ High Risk", cls: "border-danger/60 text-danger", t: "eval() runs any code" },
    { line: 5, b: "⚠️ Syntax Bug", cls: "border-warn/60 text-warn", t: "= used instead of ==" },
  ];
  return (
    <div className="grid w-full max-w-lg gap-2">
      {cards.map((c, k) => (
        <div key={k} className={cn("glass flex items-center gap-2 rounded-xl border p-2 animate-rise sm:p-3", c.cls)} style={{ animationDelay: `${k * 600}ms` }}>
          <span className="pill border-current py-0.5 text-[10px]">{c.b}</span>
          <span className="pill py-0.5 font-mono text-[10px] text-foreground">L{c.line}</span>
          <span className="truncate text-xs text-foreground sm:text-sm">{c.t}</span>
        </div>
      ))}
    </div>
  );
}

function SceneFix() {
  const [fixed, setFixed] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setFixed((f) => (f >= FIXED.length ? f : f + 1)), 700);
    return () => window.clearInterval(id);
  }, []);
  return (
    <div className="flex w-full flex-col items-center gap-3">
      <MiniEditor>
        {FIXED.map((t, k) => (
          <div key={k} className={cn("flex gap-3 whitespace-nowrap rounded transition-colors duration-500", k < fixed && BUGGY[k]?.bad && "bg-lime/15 text-lime")}>
            <span className="w-4 text-right text-muted-foreground/50">{k + 1}</span>
            <span>{k < fixed ? t : BUGGY[k]?.t}</span>
          </div>
        ))}
      </MiniEditor>
      {fixed >= FIXED.length && (
        <div className="flex items-center gap-2 rounded-full bg-gradient-lime px-4 py-2 text-xs font-bold text-primary-foreground glow-lime animate-pop sm:text-sm">
          <ShieldCheck className="size-4" /> All Clear — 100% clean!
        </div>
      )}
    </div>
  );
}
