/** Fixed, decorative space background: stars, grid, glowing orbs and floating code glyphs. */
const GLYPHS = [
  { t: "{ }", c: "text-gold", x: "8%", y: "18%", d: "0s" },
  { t: "</>", c: "text-electric", x: "86%", y: "14%", d: "1.5s" },
  { t: "#!", c: "text-pink", x: "78%", y: "62%", d: "3s" },
  { t: "( )", c: "text-lime", x: "12%", y: "72%", d: "2s" },
  { t: ";", c: "text-gold", x: "50%", y: "88%", d: "4s" },
  { t: "==", c: "text-electric", x: "92%", y: "40%", d: "5s" },
];

export function CosmicBackdrop() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className="starfield absolute inset-0 opacity-70" />
      <div className="cyber-grid absolute inset-0" />
      <div className="absolute -left-40 top-20 size-[28rem] rounded-full bg-electric/25 animate-pulse-glow" />
      <div className="absolute -right-32 top-[30%] size-[26rem] rounded-full bg-pink/20 animate-pulse-glow [animation-delay:1.2s]" />
      <div className="absolute bottom-[-10rem] left-1/3 size-[30rem] rounded-full bg-gold/15 animate-pulse-glow [animation-delay:2s]" />
      {GLYPHS.map((g) => (
        <span
          key={g.t + g.x}
          className={`absolute hidden font-mono text-2xl font-bold opacity-30 animate-float-slow sm:block ${g.c}`}
          style={{ left: g.x, top: g.y, animationDelay: g.d }}
        >
          {g.t}
        </span>
      ))}
    </div>
  );
}
