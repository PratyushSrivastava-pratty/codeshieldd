import { useState, type FormEvent, type ReactNode } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Bug, CheckCircle2, Heart, Lightbulb, Loader2, Mail, MessageSquareHeart, Send, Sparkles } from "lucide-react";
import { PageHero } from "@/components/layout/page-hero";
import { useAuth } from "@/hooks/use-auth";
import { submitFeedback } from "@/lib/feedback/feedback.functions";
import { CATEGORY_LABELS, FEEDBACK_CATEGORIES, FEEDBACK_EMAIL, feedbackSchema, type FeedbackCategory } from "@/lib/feedback/schema";
import { cn } from "@/lib/utils";

const TITLE = "Feedback — Help shape CodeShield";
const DESC = "Report a bug, suggest a feature or say hi. Every message goes straight to CodeShield's founder, Pratyush Srivastava.";

export const Route = createFileRoute("/feedback")({
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
  component: FeedbackPage,
});

const ICONS: Record<FeedbackCategory, typeof Bug> = { general: MessageSquareHeart, bug: Bug, idea: Lightbulb, praise: Heart };
const TONES: Record<FeedbackCategory, string> = {
  general: "text-electric",
  bug: "text-pink",
  idea: "text-gold",
  praise: "text-lime",
};

function FeedbackPage() {
  const { user } = useAuth();
  const send = useServerFn(submitFeedback);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [category, setCategory] = useState<FeedbackCategory>("general");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<string, string>>>({});
  const [sent, setSent] = useState(false);

  const effectiveEmail = email || user?.email || "";

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const parsed = feedbackSchema.safeParse({ name, email: effectiveEmail, category, message });
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues) next[String(issue.path[0])] ??= issue.message;
      setErrors(next);
      return;
    }
    setErrors({});
    setBusy(true);
    try {
      await send({ data: parsed.data });
      setSent(true);
      setMessage("");
      toast.success("Feedback sent — thank you! 💛");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not send feedback");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6">
      <PageHero icon={MessageSquareHeart} kicker="Feedback" title={<>Tell us what you <span className="text-gradient-neon">think.</span></>}>
        Found a bug, have an idea, or just want to say hi? Your message goes straight to the founder's inbox.
      </PageHero>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="glass neon-frame rounded-3xl p-6 sm:p-8">
          {sent ? (
            <div className="flex flex-col items-center gap-4 py-10 text-center">
              <CheckCircle2 className="size-14 text-lime animate-wobble" />
              <h2 className="font-display text-2xl font-bold">Message received!</h2>
              <p className="max-w-sm text-sm text-muted-foreground">Thanks for helping make CodeShield better. If you asked a question, a reply will come to {effectiveEmail}.</p>
              <button
                type="button"
                onClick={() => setSent(false)}
                className="rounded-full border border-input bg-surface/70 px-5 py-2 text-sm font-semibold transition hover:glow-electric"
              >
                Send another
              </button>
            </div>
          ) : (
            <form onSubmit={onSubmit} noValidate className="space-y-5">
              <fieldset>
                <legend className="mb-2 text-sm font-semibold">What's it about?</legend>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {FEEDBACK_CATEGORIES.map((c) => {
                    const Icon = ICONS[c];
                    return (
                      <button
                        key={c}
                        type="button"
                        aria-pressed={category === c}
                        onClick={() => setCategory(c)}
                        className={cn(
                          "flex flex-col items-center gap-1.5 rounded-2xl border px-2 py-3 text-xs font-semibold transition",
                          category === c ? "border-gold bg-surface-2 glow-gold" : "border-input bg-editor/60 text-muted-foreground hover:text-foreground",
                        )}
                      >
                        <Icon className={cn("size-5", TONES[c])} />
                        {CATEGORY_LABELS[c]}
                      </button>
                    );
                  })}
                </div>
              </fieldset>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Your name" error={errors["name"]}>
                  <input value={name} onChange={(e) => setName(e.target.value)} maxLength={100} autoComplete="name" placeholder="Ada Lovelace" className={inputCls} />
                </Field>
                <Field label="Your email" error={errors["email"]}>
                  <input
                    type="email"
                    value={effectiveEmail}
                    onChange={(e) => setEmail(e.target.value)}
                    maxLength={255}
                    autoComplete="email"
                    placeholder="you@school.dev"
                    className={inputCls}
                  />
                </Field>
              </div>

              <Field label="Message" error={errors["message"]} hint={`${message.length}/2000`}>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  maxLength={2000}
                  rows={6}
                  placeholder="The scanner flagged… / I'd love it if CodeShield could…"
                  className={cn(inputCls, "h-auto resize-y py-3")}
                />
              </Field>

              <button
                type="submit"
                disabled={busy}
                className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-gold font-display text-sm font-bold text-primary-foreground transition-transform hover:scale-[1.02] active:scale-95 disabled:opacity-60"
              >
                {busy ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                Send feedback
              </button>
            </form>
          )}
        </div>

        <aside className="space-y-4">
          <div className="glass rounded-3xl p-6">
            <Sparkles className="size-7 text-gold" />
            <h2 className="mt-3 font-display text-lg font-bold">Every message is read</h2>
            <p className="mt-2 text-sm text-muted-foreground">CodeShield is built by one person. Bug reports get fixed, ideas get considered, and praise keeps the shield polished.</p>
          </div>
          <div className="glass rounded-3xl p-6">
            <Mail className="size-7 text-electric" />
            <h2 className="mt-3 font-display text-lg font-bold">Prefer email?</h2>
            <p className="mt-2 text-sm text-muted-foreground">Write directly from your own mail app.</p>
            <a
              href={`mailto:${FEEDBACK_EMAIL}?subject=${encodeURIComponent("CodeShield feedback")}`}
              className="mt-4 inline-flex items-center gap-2 rounded-full border border-input bg-surface/70 px-4 py-2 text-sm font-semibold transition hover:glow-electric"
            >
              <Mail className="size-4" /> {FEEDBACK_EMAIL}
            </a>
          </div>
        </aside>
      </div>
    </div>
  );
}

const inputCls =
  "h-11 w-full rounded-xl border border-input bg-editor/70 px-3 text-sm outline-none placeholder:text-muted-foreground focus:glow-electric";

function Field({ label, error, hint, children }: { label: string; error?: string | undefined; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 flex justify-between text-sm font-semibold">
        {label}
        {hint ? <span className="text-xs font-normal text-muted-foreground">{hint}</span> : null}
      </span>
      {children}
      {error ? <span className="mt-1 block text-xs text-pink">{error}</span> : null}
    </label>
  );
}
