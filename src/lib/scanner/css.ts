import { mask } from "./tokenize";
import { checkBrackets, checkUnterminated, checkSecrets } from "./common";
import { Ctx, closest } from "./util";
import type { Issue } from "./types";

export const CSS_PROPERTIES = new Set(
  `align-content align-items align-self all animation animation-delay animation-direction animation-duration animation-fill-mode animation-iteration-count animation-name animation-play-state animation-timing-function appearance aspect-ratio backdrop-filter backface-visibility background background-attachment background-blend-mode background-clip background-color background-image background-origin background-position background-repeat background-size block-size border border-block border-bottom border-bottom-color border-bottom-left-radius border-bottom-right-radius border-bottom-style border-bottom-width border-collapse border-color border-image border-inline border-left border-left-color border-left-style border-left-width border-radius border-right border-right-color border-right-style border-right-width border-spacing border-style border-top border-top-color border-top-left-radius border-top-right-radius border-top-style border-top-width border-width bottom box-shadow box-sizing break-after break-before caption-side caret-color clear clip clip-path color column-count column-gap column-rule column-width columns contain container container-type content counter-increment counter-reset cursor direction display empty-cells fill filter flex flex-basis flex-direction flex-flow flex-grow flex-shrink flex-wrap float font font-family font-feature-settings font-kerning font-size font-stretch font-style font-variant font-variation-settings font-weight gap grid grid-area grid-auto-columns grid-auto-flow grid-auto-rows grid-column grid-column-end grid-column-start grid-row grid-row-end grid-row-start grid-template grid-template-areas grid-template-columns grid-template-rows height hyphens image-rendering inline-size inset isolation justify-content justify-items justify-self left letter-spacing line-height list-style list-style-image list-style-position list-style-type margin margin-block margin-bottom margin-inline margin-left margin-right margin-top mask max-height max-width min-height min-width mix-blend-mode object-fit object-position opacity order outline outline-color outline-offset outline-style outline-width overflow overflow-wrap overflow-x overflow-y overscroll-behavior padding padding-block padding-bottom padding-inline padding-left padding-right padding-top perspective place-content place-items place-self pointer-events position quotes resize right rotate row-gap scale scroll-behavior scroll-margin scroll-padding scroll-snap-align scroll-snap-type scrollbar-color scrollbar-width src stroke stroke-width tab-size table-layout text-align text-decoration text-decoration-color text-decoration-line text-decoration-style text-indent text-overflow text-shadow text-transform text-underline-offset top touch-action transform transform-origin transform-style transition transition-delay transition-duration transition-property transition-timing-function translate unicode-range user-select vertical-align visibility white-space width will-change word-break word-spacing word-wrap writing-mode z-index accent-color font-display`.split(
    /\s+/,
  ),
);

const LENGTH_PROPS = new Set(
  "width height min-width min-height max-width max-height margin margin-top margin-bottom margin-left margin-right padding padding-top padding-bottom padding-left padding-right top left right bottom font-size border-radius gap row-gap column-gap border-width letter-spacing text-indent outline-width outline-offset".split(" "),
);

const DECL_START = /^\s*(-?-?[a-zA-Z][\w-]*)\s*:/;

export function scanCss(code: string): Issue[] {
  const { masked, unterminated } = mask(code, { blockComments: [["/*", "*/"]], quotes: ['"', "'"] });
  const ctx = new Ctx(code.split("\n"), masked.split("\n"), "css");
  checkUnterminated(ctx, unterminated);
  checkSecrets(ctx);
  const skip = new Set(unterminated.map((u) => u.line));

  // Depth at line start
  const depthStart: number[] = [];
  let d = 0;
  for (const l of ctx.mlines) {
    depthStart.push(d);
    for (const c of l) {
      if (c === "{") d++;
      else if (c === "}") d = Math.max(0, d - 1);
    }
  }

  const isDecl = (n: number) => {
    const l = ctx.mline(n);
    if (l.includes("{")) return false;
    if (DECL_START.test(l)) return true;
    const nc = /^\s*([a-zA-Z-]+)\s+[^:{};]+;?\s*$/.exec(l);
    return !!nc && CSS_PROPERTIES.has(nc[1] ?? "");
  };

  // Selector missing "{"
  const virtual = [...ctx.mlines];
  for (let n = 1; n <= ctx.lineCount; n++) {
    const t = ctx.mline(n).trim();
    if (!t || (depthStart[n - 1] ?? 0) !== 0 || skip.has(n)) continue;
    if (/[{},;]$/.test(t) || t.startsWith("@") && t.endsWith(";")) continue;
    const next = ctx.nextCodeLine(n);
    if (next < 0) continue;
    const nt = ctx.mline(next).trim();
    if (DECL_START.test(nt) && nt.endsWith(";") && !/^[\w-]+\s*:\s*[\w-]+\s*$/.test(t)) {
      ctx.add({
        rule: "missing-open-brace", line: n, column: t.length, category: "syntax", severity: "high",
        title: 'Missing "{" after selector',
        message: `"${t}" is followed by style rules, but there is no "{" to open the block.`,
        suggestion: 'Add " {" after the selector.',
        patches: [ctx.appendToContent(n, " {")],
      });
      virtual[n - 1] = (virtual[n - 1] ?? "") + "{";
    }
  }
  checkBrackets(ctx, virtual.join("\n"), skip);

  for (let n = 1; n <= ctx.lineCount; n++) {
    const m = ctx.mline(n);
    const raw = ctx.line(n);
    const t = m.trim();
    if (!t || skip.has(n)) continue;
    const depth = depthStart[n - 1] ?? 0;
    const inBlock = depth >= 1 && !m.includes("{") && t !== "}";
    if (!inBlock && !(depth >= 1 && m.includes("{") && m.includes("}"))) {
      // still check @import http
    }

    if (inBlock) {
      const body = t.replace(/\}\s*$/, "").trim();
      if (!body) continue;
      // Missing colon: "width 300px;"
      const nc = /^(\s*)([a-zA-Z-]+)\s+([^:{};]+?)\s*;?\s*\}?$/.exec(m);
      if (nc && !m.includes(":") && CSS_PROPERTIES.has(nc[2] ?? "")) {
        const k = (nc[1] ?? "").length + (nc[2] ?? "").length;
        ctx.add({
          rule: "missing-colon", line: n, column: k, category: "syntax", severity: "high",
          title: `Missing ":" after "${nc[2]}"`,
          message: "Every CSS declaration needs a colon between the property and its value. Without it the whole rule is ignored.",
          suggestion: `${nc[2]}: ${nc[3]};`,
          patches: [ctx.replaceRange(n, k, raw.slice(k).length - raw.slice(k).trimStart().length, ": ")],
        });
        continue;
      }
      // Multiple declarations on one line without ;
      const segs = body.split(";");
      let offset = m.indexOf(body);
      for (const seg of segs) {
        const props = [...seg.matchAll(/(?:^|\s)(-?-?[a-zA-Z][\w-]*)\s*:(?!\/\/)/g)];
        if (props.length > 1) {
          const second = props[1];
          const pos = offset + (second?.index ?? 0) + ((second?.[0] ?? "").length - (second?.[0] ?? "").trimStart().length);
          const before = raw.slice(0, pos).replace(/\s+$/, "");
          ctx.add({
            rule: "missing-semicolon", line: n, column: before.length, category: "syntax", severity: "high",
            title: "Missing semicolon between declarations",
            message: "Two declarations are run together, so the browser reads them as one broken value.",
            suggestion: 'Add ";" between them.',
            patches: [ctx.replaceRange(n, before.length, pos - before.length, "; ")],
          });
        }
        offset += seg.length + 1;
      }
      // Missing semicolon at line end
      if (DECL_START.test(m) && !/[;{}]$/.test(t)) {
        const next = ctx.nextCodeLine(n);
        if (next > 0 && isDecl(next)) {
          ctx.add({
            rule: "missing-semicolon", line: n, column: ctx.contentEnd(n), category: "syntax", severity: "high",
            title: "Missing semicolon",
            message: "Without a ; this declaration and the next one merge into a single invalid value, so BOTH are ignored.",
            suggestion: 'Add ";" at the end of the line.',
            patches: [ctx.appendToContent(n, ";")],
          });
        }
      }
      const decl = DECL_START.exec(m);
      if (decl) {
        const prop = decl[1] ?? "";
        const pk = m.indexOf(prop);
        const lower = prop.toLowerCase();
        if (!prop.startsWith("-") && !CSS_PROPERTIES.has(lower)) {
          const fix = closest(lower, CSS_PROPERTIES, 2);
          ctx.add({
            rule: "unknown-property", line: n, column: pk, category: fix ? "syntax" : "quality", severity: fix ? "high" : "low",
            title: fix ? `Typo in property "${prop}"` : `Unknown property "${prop}"`,
            message: fix
              ? `Browsers silently ignore unknown properties. "${prop}" looks like a typo for "${fix}".`
              : `"${prop}" isn't a standard CSS property, so browsers will ignore it.`,
            suggestion: fix ? `Use "${fix}".` : "Check the spelling on MDN.",
            patches: fix ? [ctx.replaceRange(n, pk, prop.length, fix)] : [],
          });
        }
        const valueStart = m.indexOf(":", pk) + 1;
        const value = raw.slice(valueStart).replace(/[;}\s]+$/, "").trim();
        // Missing unit
        const num = /^(-?\d*\.?\d+)$/.exec(value);
        if (num && LENGTH_PROPS.has(lower) && Number(num[1]) !== 0) {
          const vk = raw.indexOf(value, valueStart);
          ctx.add({
            rule: "missing-unit", line: n, column: vk, category: "bug", severity: "medium",
            title: `"${value}" needs a unit`,
            message: `${prop} needs a unit like px, rem or %. A bare number is invalid, so the browser ignores it.`,
            suggestion: `Use ${value}px.`,
            patches: [ctx.replaceRange(n, vk, value.length, `${value}px`)],
          });
        }
        // Invalid hex colours
        for (const hx of raw.slice(valueStart).matchAll(/#([0-9a-zA-Z]+)\b/g)) {
          const h = hx[1] ?? "";
          const validChars = /^[0-9a-fA-F]+$/.test(h);
          if (validChars && [3, 4, 6, 8].includes(h.length)) continue;
          let fixed = h.replace(/[^0-9a-fA-F]/g, "0");
          if (fixed.length > 8) fixed = fixed.slice(0, 8);
          else if (fixed.length === 7) fixed = fixed.slice(0, 6);
          else if (fixed.length === 5) fixed = fixed + fixed.slice(-1);
          else if (fixed.length < 3) fixed = fixed.padEnd(3, fixed.slice(-1) || "0");
          const k = valueStart + (hx.index ?? 0);
          ctx.add({
            rule: "invalid-color", line: n, column: k, category: "syntax", severity: "high",
            title: `Invalid colour "#${h}"`,
            message: validChars
              ? `Hex colours must have 3, 4, 6 or 8 digits — "#${h}" has ${h.length}, so the browser ignores it.`
              : `"#${h}" contains characters that aren't hex digits (0-9, a-f).`,
            suggestion: `Use a valid colour such as #${fixed} (double-check the shade).`,
            patches: [ctx.replaceRange(n, k, h.length + 1, `#${fixed}`)],
          });
        }
        // Script injection in CSS
        const inj = /(expression\s*\(|javascript:)/i.exec(raw);
        if (inj) {
          ctx.add({
            rule: "css-injection", line: n, column: inj.index, category: "security", severity: "high",
            title: "Script injection in CSS",
            message: `"${inj[1]}" in a stylesheet can run JavaScript in old browsers and is a known attack vector.`,
            suggestion: "Remove this declaration.",
            patches: [{ op: "delete", line: n }],
          });
        }
      }
    }

    const imp = /@import\s+(?:url\()?\s*["']?http:\/\//.exec(raw);
    if (imp) {
      const k = raw.indexOf("http://");
      ctx.add({
        rule: "insecure-http", line: n, column: k, category: "security", severity: "medium",
        title: "Stylesheet loaded over HTTP",
        message: "An http:// stylesheet can be tampered with in transit and is blocked on https sites.",
        suggestion: "Use https://.",
        patches: [ctx.replaceRange(n, k, 7, "https://")],
      });
    }
  }
  return ctx.issues;
}
