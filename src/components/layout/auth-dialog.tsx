import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Loader2, Lock, Mail, Sparkles, UserPlus, LogIn, KeyRound } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { useAuth } from "@/hooks/use-auth";
import { BRAND } from "@/lib/brand";
import { cn } from "@/lib/utils";

type Mode = "login" | "register" | "forgot";

export function AuthDialog() {
  const { authOpen, setAuthOpen } = useAuth();
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setNotice(null);
    try {
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Welcome back, shield bearer! 🛡️");
      } else if (mode === "register") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        if (data.session) toast.success("Account created — you're in! 🚀");
        else setNotice("Almost there! Check your inbox and tap the confirmation link to activate your account.");
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        setNotice("Reset link sent! Check your inbox to choose a new password.");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  async function social(provider: "google" | "lovable") {
    setBusy(true);
    const result = await lovable.auth.signInWithOAuth(provider, { redirect_uri: window.location.origin });
    if ("error" in result && result.error) {
      toast.error(result.error.message || "Sign-in failed");
      setBusy(false);
    }
  }

  const title = mode === "login" ? "Welcome back" : mode === "register" ? "Join CodeShield" : "Reset password";

  return (
    <Dialog
      open={authOpen}
      onOpenChange={(o) => {
        setAuthOpen(o);
        if (!o) setNotice(null);
      }}
    >
      <DialogContent className="glass neon-frame max-w-md rounded-3xl border-0 p-0 sm:rounded-3xl">
        <div className="relative overflow-hidden rounded-3xl p-6 sm:p-8">
          <div className="pointer-events-none absolute -right-16 -top-16 size-48 rounded-full bg-pink/30 animate-pulse-glow" />
          <div className="pointer-events-none absolute -bottom-20 -left-10 size-48 rounded-full bg-electric/30 animate-pulse-glow" />
          <DialogHeader className="relative items-center text-center sm:text-center">
            <img src={BRAND.emblemUrl} alt="" className="mb-2 size-14 animate-wobble object-contain" />
            <DialogTitle className="font-display text-2xl">{title}</DialogTitle>
            <DialogDescription>Save every scan and pick up right where you left off.</DialogDescription>
          </DialogHeader>

          {mode !== "forgot" && (
            <div className="relative mt-6 grid grid-cols-2 gap-1 rounded-full bg-muted/60 p-1">
              {(["login", "register"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => {
                    setMode(m);
                    setNotice(null);
                  }}
                  className={cn(
                    "flex items-center justify-center gap-1.5 rounded-full py-2 text-sm font-semibold transition-all",
                    mode === m ? "bg-gradient-gold text-primary-foreground shadow" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {m === "login" ? <LogIn className="size-4" /> : <UserPlus className="size-4" />}
                  {m === "login" ? "Login" : "Register"}
                </button>
              ))}
            </div>
          )}

          {notice ? (
            <div className="relative mt-6 rounded-2xl border border-lime/40 bg-lime/10 p-4 text-sm text-lime">{notice}</div>
          ) : null}

          <form onSubmit={submit} className="relative mt-5 space-y-3">
            <label className="block">
              <span className="sr-only">Email</span>
              <div className="flex items-center gap-2 rounded-xl border border-input bg-editor/70 px-3 focus-within:glow-electric">
                <Mail className="size-4 text-muted-foreground" />
                <input
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@school.dev"
                  className="h-11 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                />
              </div>
            </label>
            {mode !== "forgot" && (
              <label className="block">
                <span className="sr-only">Password</span>
                <div className="flex items-center gap-2 rounded-xl border border-input bg-editor/70 px-3 focus-within:glow-electric">
                  <Lock className="size-4 text-muted-foreground" />
                  <input
                    type="password"
                    required
                    minLength={6}
                    autoComplete={mode === "login" ? "current-password" : "new-password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Password (6+ characters)"
                    className="h-11 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                  />
                </div>
              </label>
            )}
            <button
              type="submit"
              disabled={busy}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-gold font-display text-sm font-bold text-primary-foreground transition-transform hover:scale-[1.02] active:scale-95 disabled:opacity-60"
            >
              {busy ? <Loader2 className="size-4 animate-spin" /> : mode === "forgot" ? <KeyRound className="size-4" /> : <Sparkles className="size-4" />}
              {mode === "login" ? "Login" : mode === "register" ? "Create account" : "Send reset link"}
            </button>
          </form>

          <div className="relative mt-3 flex justify-between text-xs">
            {mode === "forgot" ? (
              <button type="button" onClick={() => setMode("login")} className="text-electric hover:underline">
                ← Back to login
              </button>
            ) : (
              <button type="button" onClick={() => setMode("forgot")} className="text-muted-foreground hover:text-foreground">
                Forgot password?
              </button>
            )}
          </div>

          {mode !== "forgot" && (
            <>
              <div className="relative my-5 flex items-center gap-3 text-xs text-muted-foreground">
                <span className="h-px flex-1 bg-border" />
                or continue with
                <span className="h-px flex-1 bg-border" />
              </div>
              <div className="relative grid grid-cols-2 gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => social("google")}
                  className="flex h-11 items-center justify-center gap-2 rounded-xl border border-input bg-surface/70 text-sm font-semibold transition hover:glow-electric disabled:opacity-60"
                >
                  <GoogleMark /> Google
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => social("lovable")}
                  className="flex h-11 items-center justify-center gap-2 rounded-xl border border-input bg-surface/70 text-sm font-semibold transition hover:glow-pink disabled:opacity-60"
                >
                  <span aria-hidden>💜</span> Lovable
                </button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function GoogleMark() {
  return (
    <svg viewBox="0 0 48 48" className="size-4" aria-hidden>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}
