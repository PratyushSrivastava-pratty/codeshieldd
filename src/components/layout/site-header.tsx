import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { LogIn, LogOut, Menu, ScanLine, Info, Award, Brain, Scale, X, Crown } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { BRAND } from "@/lib/brand";
import { cn } from "@/lib/utils";

export const NAV = [
  { to: "/", label: "Scanner", icon: ScanLine },
  { to: "/about", label: "About", icon: Info },
  { to: "/credits", label: "Credits", icon: Award },
  { to: "/dev-thinking", label: "Dev Thinking", icon: Brain },
  { to: "/terms", label: "T&C/Copyright", icon: Scale },
] as const;

export function SiteHeader() {
  const { user, loading, setAuthOpen, signOut } = useAuth();
  const [open, setOpen] = useState(false);

  const authButton = loading ? (
    <div className="h-10 w-24 animate-pulse rounded-full bg-muted" />
  ) : user ? (
    <div className="flex items-center gap-2">
      <span className="hidden max-w-40 truncate text-xs text-muted-foreground xl:inline" title={user.email ?? ""}>
        {user.email}
      </span>
      <button
        onClick={() => signOut()}
        className="flex h-10 items-center gap-2 rounded-full border border-input bg-surface/70 px-4 text-sm font-semibold transition hover:glow-pink active:scale-95"
      >
        <LogOut className="size-4" /> Logout
      </button>
    </div>
  ) : (
    <button
      onClick={() => setAuthOpen(true)}
      className="flex h-10 items-center gap-2 rounded-full bg-gradient-gold px-4 text-sm font-bold text-primary-foreground transition hover:scale-105 hover:glow-gold active:scale-95"
    >
      <LogIn className="size-4" /> Login / Register
    </button>
  );

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/70 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 sm:px-6">
        <Link to="/" className="group flex shrink-0 items-center gap-2.5" onClick={() => setOpen(false)}>
          <img
            src={BRAND.emblemUrl}
            alt="CodeShield logo"
            className="size-10 object-contain drop-shadow-[0_0_12px_var(--gold)] transition-transform group-hover:rotate-[-8deg] group-hover:scale-110"
          />
          <div className="leading-none">
            <span className="block font-display text-lg font-bold tracking-tight text-gradient-gold">CodeShield</span>
            <span className="hidden text-[10px] uppercase tracking-[0.2em] text-muted-foreground sm:block">secure · strengthen</span>
          </div>
        </Link>
        <span className="pill hidden border-gold/40 text-gold lg:inline-flex">
          <Crown className="size-3" /> Built by {BRAND.founder}
        </span>

        <nav className="ml-auto hidden items-center gap-1 md:flex" aria-label="Main">
          {NAV.map((n) => (
            <Link
              key={n.to}
              to={n.to}
              activeOptions={{ exact: true }}
              className="rounded-full px-3 py-2 text-sm font-medium text-muted-foreground transition hover:bg-muted/60 hover:text-foreground"
              activeProps={{ className: "!bg-surface-2 !text-foreground glow-electric" }}
            >
              {n.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto hidden md:ml-2 md:block">{authButton}</div>

        <button
          className="ml-auto flex size-10 items-center justify-center rounded-full border border-input md:hidden"
          onClick={() => setOpen((o) => !o)}
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
        >
          {open ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </div>

      <div className={cn("overflow-hidden border-t border-border/60 md:hidden", open ? "block" : "hidden")}>
        <nav className="mx-auto grid max-w-7xl gap-1 p-4" aria-label="Mobile">
          <span className="pill mb-2 w-fit border-gold/40 text-gold">
            <Crown className="size-3" /> Built by {BRAND.founder}
          </span>
          {NAV.map((n) => (
            <Link
              key={n.to}
              to={n.to}
              onClick={() => setOpen(false)}
              activeOptions={{ exact: true }}
              className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-muted-foreground"
              activeProps={{ className: "!bg-surface-2 !text-foreground" }}
            >
              <n.icon className="size-4" /> {n.label}
            </Link>
          ))}
          <div className="mt-2" onClick={() => setOpen(false)}>
            {authButton}
          </div>
        </nav>
      </div>
    </header>
  );
}
