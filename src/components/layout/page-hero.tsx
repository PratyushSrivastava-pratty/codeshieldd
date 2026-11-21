import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

export function PageHero({ icon: Icon, kicker, title, children }: { icon: LucideIcon; kicker: string; title: ReactNode; children?: ReactNode }) {
  return (
    <section className="relative pb-8 pt-12 sm:pt-20">
      <div className="pointer-events-none absolute -top-10 left-0 -z-10 size-72 rounded-full bg-electric/20 animate-pulse-glow" />
      <span className="pill animate-rise border-pink/40 text-pink">
        <Icon className="size-3.5" /> {kicker}
      </span>
      <h1 className="mt-5 max-w-4xl font-display text-4xl font-black leading-[1.05] tracking-tight animate-rise sm:text-6xl">{title}</h1>
      {children ? <div className="mt-5 max-w-2xl text-base text-muted-foreground animate-rise [animation-delay:120ms] sm:text-lg">{children}</div> : null}
    </section>
  );
}

export function GlowCard({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`glass rounded-3xl p-6 transition hover:-translate-y-1 hover:glow-electric ${className}`}>{children}</div>;
}
