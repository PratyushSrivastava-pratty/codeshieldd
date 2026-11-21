import { createFileRoute } from "@tanstack/react-router";
import { Award, Crown, ExternalLink } from "lucide-react";
import { PageHero, GlowCard } from "@/components/layout/page-hero";
import { BRAND } from "@/lib/brand";

const TITLE = "Credits — The people & tools behind CodeShield";
const DESC = "CodeShield is founded and led by Pratyush Srivastava, built on open-source tools like React, TanStack, Tailwind CSS and Lucide icons.";

export const Route = createFileRoute("/credits")({
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
  component: CreditsPage,
});

const LIBS = [
  { n: "React", d: "The UI engine powering every screen.", u: "https://react.dev" },
  { n: "TanStack Start & Router", d: "Pages, navigation and fast loading.", u: "https://tanstack.com" },
  { n: "TanStack Query", d: "Keeps your scan history fresh.", u: "https://tanstack.com/query" },
  { n: "Tailwind CSS", d: "The neon styling system.", u: "https://tailwindcss.com" },
  { n: "Lucide icons", d: "Every crisp icon you see.", u: "https://lucide.dev" },
  { n: "Radix UI & shadcn/ui", d: "Accessible dialogs and menus.", u: "https://www.radix-ui.com" },
  { n: "Sonner", d: "The success toasts.", u: "https://sonner.emilkowal.ski" },
  { n: "Google Fonts", d: "Unbounded, Space Grotesk, JetBrains Mono.", u: "https://fonts.google.com" },
];

function CreditsPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6">
      <PageHero icon={Award} kicker="Credits" title={<>Made with <span className="text-gradient-neon">obsession.</span></>} />

      <section className="glass neon-frame relative overflow-hidden rounded-3xl p-8 sm:p-12">
        <div className="pointer-events-none absolute -right-20 -top-20 size-72 rounded-full bg-gold/25 animate-pulse-glow" />
        <div className="relative flex flex-col items-center gap-8 text-center md:flex-row md:text-left">
          <div className="relative flex size-36 shrink-0 items-center justify-center rounded-full bg-gradient-gold glow-gold animate-float">
            <span className="font-display text-5xl font-black text-primary-foreground">PS</span>
            <Crown className="absolute -top-5 size-10 text-gold animate-wobble" />
          </div>
          <div>
            <span className="pill border-gold/50 text-gold">Founder & Lead Creator</span>
            <h2 className="mt-3 font-display text-4xl font-black sm:text-5xl text-gradient-gold">{BRAND.founder}</h2>
            <p className="mt-3 max-w-xl text-muted-foreground">
              Product vision, scanner design, interface and brand — CodeShield is Pratyush's idea, from the first sketch of the shield logo to
              the last auto-fix rule.
            </p>
          </div>
        </div>
      </section>

      <h2 className="mt-16 font-display text-2xl font-bold">Open-source superpowers</h2>
      <p className="mt-2 text-sm text-muted-foreground">CodeShield stands on the shoulders of these brilliant open-source projects.</p>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {LIBS.map((l) => (
          <a key={l.n} href={l.u} target="_blank" rel="noopener noreferrer" className="group">
            <GlowCard className="h-full">
              <div className="flex items-center justify-between">
                <h3 className="font-display font-bold">{l.n}</h3>
                <ExternalLink className="size-4 text-muted-foreground transition group-hover:text-electric" />
              </div>
              <p className="mt-2 text-sm text-muted-foreground">{l.d}</p>
            </GlowCard>
          </a>
        ))}
      </div>
    </div>
  );
}
