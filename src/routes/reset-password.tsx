import { useEffect, useState, type FormEvent } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { KeyRound, Loader2, Lock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const TITLE = "Reset your password — CodeShield";
const DESC = "Choose a new password for your CodeShield account.";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESC },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESC },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (window.location.hash.includes("type=recovery")) setReady(true);
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setReady(true);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Password updated — you're all set! 🔐");
    navigate({ to: "/" });
  }

  return (
    <div className="mx-auto flex max-w-md flex-col px-4 py-20">
      <div className="glass neon-frame rounded-3xl p-8">
        <KeyRound className="size-10 text-gold" />
        <h1 className="mt-4 font-display text-2xl font-bold">Set a new password</h1>
        {ready ? (
          <form onSubmit={submit} className="mt-6 space-y-3">
            <div className="flex items-center gap-2 rounded-xl border border-input bg-editor/70 px-3 focus-within:glow-electric">
              <Lock className="size-4 text-muted-foreground" />
              <input
                type="password"
                required
                minLength={6}
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="New password (6+ characters)"
                aria-label="New password"
                className="h-11 w-full bg-transparent text-sm outline-none"
              />
            </div>
            <button
              type="submit"
              disabled={busy}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-gold font-display text-sm font-bold text-primary-foreground disabled:opacity-60"
            >
              {busy && <Loader2 className="size-4 animate-spin" />} Update password
            </button>
          </form>
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">
            Open this page from the reset link in your email. If the link expired, use “Forgot password?” in the login window to get a new one.
          </p>
        )}
      </div>
    </div>
  );
}
