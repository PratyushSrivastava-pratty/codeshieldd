import { createFileRoute } from "@tanstack/react-router";
import { Scale, Copyright } from "lucide-react";
import { PageHero } from "@/components/layout/page-hero";
import { BRAND } from "@/lib/brand";

const TITLE = "Terms & Copyright — CodeShield";
const DESC = "Terms of use, disclaimers and copyright notice for CodeShield by Pratyush Srivastava.";

export const Route = createFileRoute("/terms")({
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
  component: TermsPage,
});

const SECTIONS = [
  {
    t: "Using CodeShield",
    d: "CodeShield is provided to help you find and fix problems in your code. By using it, you agree to use it lawfully and not to attempt to disrupt, overload or reverse-engineer the service.",
  },
  {
    t: "Your code stays yours",
    d: "You keep full ownership of any code you paste. Scanning happens right in your browser. If you're logged in, a copy of each scan is saved to your private history so only you can see it — and you can delete any entry at any time.",
  },
  {
    t: "No guarantees",
    d: "CodeShield is a helpful assistant, not a replacement for testing, code review or a professional security audit. Results and automatic fixes are provided “as is” without warranty of any kind. Always review changes before using code in production.",
  },
  {
    t: "Limitation of liability",
    d: "To the fullest extent allowed by law, CodeShield and its creator are not liable for any loss, damage or cost arising from use of the scanner, its results or its automatic fixes.",
  },
  {
    t: "Accounts",
    d: "You're responsible for keeping your login details safe. We may suspend accounts that abuse the service.",
  },
  {
    t: "Changes",
    d: "These terms may be updated as CodeShield grows. Continuing to use the app after changes means you accept the updated terms.",
  },
];

function TermsPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-6">
      <PageHero icon={Scale} kicker="Terms & Copyright" title={<>The <span className="text-gradient-neon">fine print,</span> but readable.</>}>
        Last updated: November 2026
      </PageHero>

      <ol className="space-y-4">
        {SECTIONS.map((s, k) => (
          <li key={s.t} className="glass flex gap-5 rounded-3xl p-6">
            <span className="font-display text-3xl font-black text-gradient-gold">{String(k + 1).padStart(2, "0")}</span>
            <div>
              <h2 className="font-display text-lg font-bold">{s.t}</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.d}</p>
            </div>
          </li>
        ))}
      </ol>

      <section className="glass neon-frame mt-10 rounded-3xl p-8 text-center">
        <Copyright className="mx-auto size-10 text-gold animate-spin-slow" />
        <p className="mt-4 font-display text-2xl font-black">
          © {new Date().getFullYear()} CodeShield by <span className="text-gradient-gold">{BRAND.founder}</span>
        </p>
        <p className="mx-auto mt-3 max-w-xl text-sm text-muted-foreground">
          All rights reserved. The CodeShield name, shield logo, design and scanner rules are the property of {BRAND.founder}. Open-source
          libraries are used under their own licenses — see the Credits page.
        </p>
      </section>
    </div>
  );
}
