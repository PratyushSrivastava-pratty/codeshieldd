import { createFileRoute } from "@tanstack/react-router";
import { Brain, MessageSquareQuote, FileText, Trophy, X, Check } from "lucide-react";
import { PageHero, GlowCard } from "@/components/layout/page-hero";
import { BRAND } from "@/lib/brand";

const TITLE = "Dev Thinking — How CodeShield was designed";
const DESC = "Pratyush Srivastava breaks down the user interviews, product brief and why accurate detection plus instant auto-fix beats heavy enterprise reports.";

export const Route = createFileRoute("/dev-thinking")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESC },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESC },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: DevThinkingPage,
});

const QUOTES = [
  { who: "Class 11 student", q: "The error said 'unexpected EOF'. I had no idea that meant I forgot a bracket." },
  { who: "2nd-year CS undergrad", q: "I lost marks because my loop ran one time too many. A tool should've told me." },
  { who: "Junior web dev", q: "I pushed an API key to GitHub once. Got a bill the next morning." },
  { who: "Senior engineer", q: "Enterprise scanners give me a 60-page PDF. I just want the line and the fix." },
];

function DevThinkingPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6">
      <PageHero icon={Brain} kicker={`By ${BRAND.founder}`} title={<>Inside the <span className="text-gradient-neon">builder's brain.</span></>}>
        How CodeShield went from late-night frustration to a product brief — and why speed, trust and instant fixes beat giant reports.
      </PageHero>

      <section>
        <div className="flex items-center gap-2">
          <MessageSquareQuote className="size-5 text-pink" />
          <h2 className="font-display text-2xl font-bold">01 · What users told me</h2>
        </div>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {QUOTES.map((x, k) => (
            <GlowCard key={k} className={k % 2 ? "sm:translate-y-6" : ""}>
              <p className="text-lg font-medium">“{x.q}”</p>
              <p className="mt-3 text-xs uppercase tracking-widest text-muted-foreground">— {x.who}</p>
            </GlowCard>
          ))}
        </div>
      </section>

      <section className="mt-20">
        <div className="flex items-center gap-2">
          <FileText className="size-5 text-electric" />
          <h2 className="font-display text-2xl font-bold">02 · The product brief</h2>
        </div>
        <div className="glass mt-6 rounded-3xl p-6 font-mono text-sm sm:p-8">
          {[
            ["Problem", "Error messages are cryptic, and security tools are built for experts."],
            ["Who", "High schoolers, CS students and working developers."],
            ["Promise", "Exact line + plain-English reason + one-tap fix, in under a second."],
            ["Languages", "Python, JavaScript, HTML, CSS, C++ — what people actually learn and ship."],
            ["North star", "Zero false alarms on clean code. Trust is everything."],
          ].map(([k, v]) => (
            <div key={k} className="grid gap-1 border-b border-border/60 py-3 last:border-0 sm:grid-cols-[140px_1fr]">
              <span className="text-gold">{k}:</span>
              <span className="text-foreground/90">{v}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-20">
        <div className="flex items-center gap-2">
          <Trophy className="size-5 text-gold" />
          <h2 className="font-display text-2xl font-bold">03 · Why instant fixes win</h2>
        </div>
        <div className="mt-6 grid gap-5 md:grid-cols-2">
          <div className="glass rounded-3xl p-6 opacity-80">
            <p className="font-display text-lg font-bold text-muted-foreground">Typical enterprise report</p>
            <ul className="mt-4 space-y-3 text-sm text-muted-foreground">
              {["Dozens of pages of findings", "Vague severity scores", "Jargon you need to Google", "You still fix everything by hand"].map((t) => (
                <li key={t} className="flex gap-2">
                  <X className="size-4 shrink-0 text-danger" /> {t}
                </li>
              ))}
            </ul>
          </div>
          <div className="glass neon-frame rounded-3xl p-6">
            <p className="font-display text-lg font-bold text-gradient-gold">The CodeShield way</p>
            <ul className="mt-4 space-y-3 text-sm">
              {["One card per problem, with the exact line", "Clear badges: High Risk, Syntax Bug, Logic Bug", "Explanations a beginner understands", "✨ Auto-Resolve patches it for you"].map((t) => (
                <li key={t} className="flex gap-2">
                  <Check className="size-4 shrink-0 text-lime" /> {t}
                </li>
              ))}
            </ul>
          </div>
        </div>
        <p className="mt-8 max-w-3xl text-muted-foreground">
          Accuracy is what earns trust: a scanner that cries wolf gets ignored. That's why every rule is tested against clean code first — if it
          raises a false alarm, it doesn't ship. Speed keeps people coming back, and auto-fix turns “I found a bug” into “it's already fixed.”
        </p>
      </section>
    </div>
  );
}
