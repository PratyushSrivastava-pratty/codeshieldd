import { createFileRoute, Link } from "@tanstack/react-router";
import { Info, GraduationCap, Briefcase, School, Target, HeartHandshake, Rocket } from "lucide-react";
import { PageHero, GlowCard } from "@/components/layout/page-hero";
import { BRAND } from "@/lib/brand";

const TITLE = "About CodeShield — Our mission";
const DESC = "Why Pratyush Srivastava built CodeShield: protecting students and developers from syntax errors, bugs and leaked keys, without corporate jargon.";

export const Route = createFileRoute("/about")({
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
  component: AboutPage,
});

function AboutPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6">
      <PageHero icon={Info} kicker="About CodeShield" title={<>Code safety that <span className="text-gradient-neon">speaks human.</span></>}>
        CodeShield was founded by <strong className="text-gold">{BRAND.founder}</strong> with one simple mission: help every coder — from a first-week
        high schooler to a senior engineer — catch mistakes and security slips before they cause pain.
      </PageHero>

      <div className="grid gap-5 md:grid-cols-3">
        {[
          { icon: School, c: "text-gold", t: "High schoolers", d: "Missing colon? Unclosed bracket? See the exact line and why it broke — no cryptic stack traces." },
          { icon: GraduationCap, c: "text-electric", t: "CS students", d: "Spot logic bugs like = vs == or off-by-one loops before they cost you marks on an assignment." },
          { icon: Briefcase, c: "text-pink", t: "Professional devs", d: "Catch hardcoded keys, eval(), innerHTML and unsafe C++ calls before they ever reach production." },
        ].map((x) => (
          <GlowCard key={x.t}>
            <x.icon className={`size-8 ${x.c}`} />
            <h2 className="mt-4 font-display text-xl font-bold">{x.t}</h2>
            <p className="mt-2 text-sm text-muted-foreground">{x.d}</p>
          </GlowCard>
        ))}
      </div>

      <section className="mt-16 grid items-center gap-10 lg:grid-cols-[1fr_1.2fr]">
        <div className="relative mx-auto">
          <div className="absolute inset-0 rounded-full bg-gold/30 animate-pulse-glow" />
          <img src={BRAND.logoUrl} alt="CodeShield shield logo" className="relative w-72 animate-float drop-shadow-[0_0_40px_var(--gold)] sm:w-80" />
        </div>
        <div className="space-y-5">
          {[
            { icon: Target, t: "The mission", d: "Make secure, bug-free code the default — not a luxury reserved for teams with security budgets." },
            { icon: HeartHandshake, t: "No jargon, ever", d: "Every warning explains what went wrong and how to fix it in plain words. If a 14-year-old can't understand it, we rewrite it." },
            { icon: Rocket, t: "Fix, don't just flag", d: "Reports are nice; fixed code is better. Most issues get a one-tap Auto-Resolve that patches your editor instantly." },
          ].map((x) => (
            <div key={x.t} className="flex gap-4">
              <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-surface-2 glow-gold">
                <x.icon className="size-5 text-gold" />
              </div>
              <div>
                <h3 className="font-display text-lg font-bold">{x.t}</h3>
                <p className="text-sm text-muted-foreground">{x.d}</p>
              </div>
            </div>
          ))}
          <Link to="/" className="inline-flex items-center gap-2 rounded-2xl bg-gradient-gold px-5 py-3 font-display text-sm font-bold text-primary-foreground transition hover:scale-105">
            Try the scanner →
          </Link>
        </div>
      </section>
    </div>
  );
}
