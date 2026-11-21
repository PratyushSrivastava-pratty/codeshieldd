import { Link } from "@tanstack/react-router";
import { BRAND } from "@/lib/brand";
import { NAV } from "./site-header";

export function SiteFooter() {
  return (
    <footer className="relative mt-24 border-t border-border/60">
      <div className="overflow-hidden border-b border-border/60 py-3">
        <div className="flex w-max animate-marquee gap-10 whitespace-nowrap font-display text-sm uppercase tracking-widest text-muted-foreground">
          {Array.from({ length: 2 }).map((_, k) => (
            <div key={k} className="flex gap-10">
              {["Python", "JavaScript", "HTML", "CSS", "C++", "Syntax", "Logic bugs", "Leaked keys", "Auto-fix", "Zero jargon"].map((w) => (
                <span key={w} className="flex items-center gap-10">
                  {w} <span className="text-gold">✦</span>
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-10 sm:px-6 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <img src={BRAND.emblemUrl} alt="" className="h-10 w-auto object-contain" />
          <div>
            <p className="font-display font-bold">CodeShield</p>
            <p className="text-xs text-muted-foreground">{BRAND.tagline}</p>
          </div>
        </div>
        <nav className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground" aria-label="Footer">
          {NAV.map((n) => (
            <Link key={n.to} to={n.to} className="hover:text-foreground">
              {n.label}
            </Link>
          ))}
        </nav>
        <p className="text-xs text-muted-foreground">
          © {new Date().getFullYear()} CodeShield by {BRAND.founder}
        </p>
      </div>
    </footer>
  );
}
