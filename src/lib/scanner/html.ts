import { mask } from "./tokenize";
import { checkSecrets, checkUnterminated } from "./common";
import { Ctx, closest, indentOf } from "./util";
import type { Issue, Patch } from "./types";
import { scanJavaScript } from "./javascript";
import { scanCss } from "./css";

export const HTML_TAGS = new Set(
  `a abbr address area article aside audio b base bdi bdo blockquote body br button canvas caption cite code col colgroup data datalist dd del details dfn dialog div dl dt em embed fieldset figcaption figure footer form h1 h2 h3 h4 h5 h6 head header hgroup hr html i iframe img input ins kbd label legend li link main map mark menu meta meter nav noscript object ol optgroup option output p param picture pre progress q rp rt ruby s samp script search section select slot small source span strong style sub summary sup table tbody td template textarea tfoot th thead time title tr track u ul var video wbr svg path circle rect line polyline polygon g defs use symbol text tspan ellipse lineargradient radialgradient stop clippath mask pattern image foreignobject math center font marquee`.split(/\s+/),
);
const VOID = new Set("area base br col embed hr img input link meta param source track wbr".split(" "));
const INLINE_CLOSE = new Set("a b i em strong span small label button title h1 h2 h3 h4 h5 h6 p li td th option code q s u mark sub sup abbr cite dt dd figcaption legend summary".split(" "));

interface Block { kind: "script" | "style"; openLine: number; closeLine: number }

export function scanHtml(code: string): Issue[] {
  const { masked: m0, unterminated } = mask(code, { blockComments: [["<!--", "-->"]] });
  // Blank out script/style contents
  const blocks: Block[] = [];
  let masked = m0;
  const lineOf = (idx: number) => {
    let l = 1;
    for (let k = 0; k < idx; k++) if (masked.charCodeAt(k) === 10) l++;
    return l;
  };
  for (const kind of ["script", "style"] as const) {
    const re = new RegExp(`<${kind}\\b[^>]*>([\\s\\S]*?)<\\/${kind}\\s*>`, "gi");
    let mm: RegExpExecArray | null;
    while ((mm = re.exec(masked))) {
      const inner = mm[1] ?? "";
      const innerStart = mm.index + mm[0].indexOf(">") + 1;
      blocks.push({ kind, openLine: lineOf(mm.index), closeLine: lineOf(innerStart + inner.length) });
      masked = masked.slice(0, innerStart) + inner.replace(/[^\n]/g, " ") + masked.slice(innerStart + inner.length);
      re.lastIndex = innerStart + inner.length;
    }
  }
  const ctx = new Ctx(code.split("\n"), masked.split("\n"), "html");
  checkUnterminated(ctx, unterminated);
  checkSecrets(ctx);

  const lineStarts = [0];
  for (let k = 0; k < masked.length; k++) if (masked[k] === "\n") lineStarts.push(k + 1);
  const pos = (idx: number) => {
    let lo = 0;
    let hi = lineStarts.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if ((lineStarts[mid] ?? 0) <= idx) lo = mid;
      else hi = mid - 1;
    }
    return { line: lo + 1, col: idx - (lineStarts[lo] ?? 0) };
  };

  type Open = { name: string; line: number; col: number; end: number };
  const stack: Open[] = [];
  const typoTargets = new Set<string>();
  const ids = new Map<string, number>();
  const tagRe = /<(\/?)([a-zA-Z][a-zA-Z0-9-]*)((?:\s[^<>]*?)?)(\/?)>/g;

  // First pass: unknown tags (typos)
  for (const t of masked.matchAll(tagRe)) {
    const name = (t[2] ?? "").toLowerCase();
    if (HTML_TAGS.has(name) || name.includes("-")) continue;
    const fix = closest(name, HTML_TAGS, 2);
    const p = pos((t.index ?? 0) + 1 + (t[1] ?? "").length);
    if (fix) typoTargets.add(fix);
    ctx.add({
      rule: "unknown-tag", line: p.line, column: p.col, category: fix ? "syntax" : "quality", severity: fix ? "high" : "low",
      title: fix ? `Typo in tag <${t[1]}${t[2]}>` : `Unknown tag <${t[2]}>`,
      message: fix
        ? `<${t[2]}> isn't an HTML element, so the browser treats it as a meaningless box. You probably meant <${fix}>.`
        : `<${t[2]}> isn't a standard HTML element.`,
      suggestion: fix ? `Rename it to <${t[1]}${fix}>.` : "Use a standard element or a custom element with a hyphen (my-widget).",
      patches: fix ? [ctx.replaceRange(p.line, p.col, (t[2] ?? "").length, fix)] : [],
    });
  }

  const closePatch = (o: Open, beforeLine?: number, beforeCol?: number): Patch => {
    const rawLine = ctx.line(o.line);
    const after = ctx.mline(o.line).slice(o.end - (lineStarts[o.line - 1] ?? 0)).trim();
    if (after && INLINE_CLOSE.has(o.name) && !/<(div|section|ul|ol|table|main|article|nav|header|footer|form)\b/i.test(after)) {
      return ctx.insertAt(o.line, ctx.contentEnd(o.line), `</${o.name}>`);
    }
    if (beforeLine !== undefined && beforeCol !== undefined) {
      const bl = ctx.line(beforeLine);
      if (bl.slice(0, beforeCol).trim() === "") return { op: "insert", line: beforeLine, text: indentOf(rawLine) + `</${o.name}>` };
      return ctx.insertAt(beforeLine, beforeCol, `</${o.name}>`);
    }
    const ind = indentOf(rawLine).length;
    for (let k = o.line + 1; k <= ctx.lineCount; k++) {
      const t = ctx.mline(k);
      if (t.trim() === "") continue;
      if (indentOf(ctx.line(k)).length <= ind) return { op: "insert", line: k, text: indentOf(rawLine) + `</${o.name}>` };
    }
    return { op: "insert", line: ctx.lineCount + 1, text: indentOf(rawLine) + `</${o.name}>` };
  };

  const reportUnclosed = (o: Open, bl?: number, bc?: number) => {
    ctx.add({
      rule: "unclosed-tag", line: o.line, column: o.col, category: "syntax", severity: "high",
      title: `Unclosed <${o.name}>`,
      message: `The <${o.name}> opened here is never closed, so everything after it gets swallowed inside it and the layout breaks.`,
      suggestion: `Add </${o.name}> where the element should end.`,
      patches: [closePatch(o, bl, bc)],
    });
  };

  for (const t of masked.matchAll(tagRe)) {
    const closing = t[1] === "/";
    const name = (t[2] ?? "").toLowerCase();
    const attrs = t[3] ?? "";
    const selfClose = t[4] === "/";
    const start = t.index ?? 0;
    const p = pos(start);
    if (!HTML_TAGS.has(name) && !name.includes("-")) continue;

    if (!closing) {
      // attribute checks
      const idm = /\bid\s*=\s*["']([^"']+)["']/.exec(attrs);
      if (idm && idm[1]) {
        const first = ids.get(idm[1]);
        if (first !== undefined) {
          const ap = pos(start + 1 + name.length + idm.index + idm[0].indexOf(idm[1]));
          ctx.add({
            rule: "duplicate-id", line: ap.line, column: ap.col, category: "bug", severity: "medium",
            title: `Duplicate id "${idm[1]}"`,
            message: `id="${idm[1]}" is already used on line ${first}. ids must be unique, or getElementById() returns the wrong element.`,
            suggestion: `Rename it, e.g. "${idm[1]}-2".`,
            patches: [ctx.replaceRange(ap.line, ap.col, idm[1].length, `${idm[1]}-2`)],
          });
        } else ids.set(idm[1], p.line);
      }
      if (name === "img" && !/\balt\s*=/.test(attrs)) {
        ctx.add({
          rule: "img-alt", line: p.line, column: p.col, category: "quality", severity: "low",
          title: "Image missing alt text",
          message: "Screen readers can't describe this image, and nothing shows if it fails to load.",
          suggestion: 'Add alt="short description".',
          patches: [ctx.insertAt(p.line, p.col + 4, ' alt=""')],
        });
      }
      if (name === "html" && !/\blang\s*=/.test(attrs)) {
        ctx.add({
          rule: "html-lang", line: p.line, column: p.col, category: "quality", severity: "low",
          title: "Missing lang attribute",
          message: "Without lang, screen readers and translators have to guess the page language.",
          suggestion: 'Use <html lang="en">.',
          patches: [ctx.insertAt(p.line, p.col + 5, ' lang="en"')],
        });
      }
      const tb = /\btarget\s*=\s*["']_blank["']/.exec(attrs);
      if (tb && !/\brel\s*=\s*["'][^"']*noopener/.test(attrs)) {
        const ap = pos(start + 1 + name.length + tb.index + tb[0].length);
        ctx.add({
          rule: "target-blank", line: ap.line, column: ap.col, category: "security", severity: "medium",
          title: 'target="_blank" without rel="noopener"',
          message: "The opened page can take control of your tab via window.opener (tabnabbing).",
          suggestion: 'Add rel="noopener noreferrer".',
          patches: [ctx.insertAt(ap.line, ap.col, ' rel="noopener noreferrer"')],
        });
      }
      const js = /\bhref\s*=\s*["']\s*javascript:[^"']*["']/i.exec(attrs);
      if (js) {
        const ap = pos(start + 1 + name.length + js.index);
        ctx.add({
          rule: "javascript-href", line: ap.line, column: ap.col, category: "security", severity: "high",
          title: "javascript: link",
          message: "javascript: URLs run code when clicked and are a common XSS vector.",
          suggestion: 'Use href="#" and attach a click handler in your script.',
          patches: [ctx.replaceRange(ap.line, ap.col, js[0].length, 'href="#"')],
        });
      }
      const http = /\b(src|href|action)\s*=\s*["']http:\/\/(?!localhost|127\.0\.0\.1)/i.exec(attrs);
      if (http) {
        const ap = pos(start + 1 + name.length + http.index + http[0].indexOf("http://"));
        ctx.add({
          rule: "insecure-http", line: ap.line, column: ap.col, category: "security", severity: "medium",
          title: "Resource loaded over HTTP",
          message: "Loading files over http:// lets attackers on the network swap them for malicious ones.",
          suggestion: "Use https://.",
          patches: [ctx.replaceRange(ap.line, ap.col, 7, "https://")],
        });
      }
      if (!VOID.has(name) && !selfClose) stack.push({ name, line: p.line, col: p.col, end: start + t[0].length });
      continue;
    }

    // closing tag
    const top = stack[stack.length - 1];
    if (top && top.name === name) {
      stack.pop();
      continue;
    }
    let deeper = -1;
    for (let k = stack.length - 1; k >= 0; k--) if (stack[k]?.name === name) { deeper = k; break; }
    if (deeper >= 0) {
      while (stack.length - 1 > deeper) {
        const o = stack.pop();
        if (o) reportUnclosed(o, p.line, p.col);
      }
      stack.pop();
    } else if (VOID.has(name)) {
      continue;
    } else if (!typoTargets.has(name)) {
      const raw = ctx.line(p.line);
      const without = raw.slice(0, p.col) + raw.slice(p.col + t[0].length);
      ctx.add({
        rule: "stray-closing-tag", line: p.line, column: p.col, category: "syntax", severity: "high",
        title: `Stray </${name}>`,
        message: `This </${name}> closes something that was never opened.`,
        suggestion: `Remove it or add the missing <${name}>.`,
        patches: [without.trim() === "" ? { op: "delete", line: p.line } : { op: "replace", line: p.line, text: without }],
      });
    }
  }
  for (const o of stack) reportUnclosed(o);

  if (/<html\b/i.test(masked) && !/<!doctype\s+html/i.test(masked)) {
    ctx.add({
      rule: "doctype", line: 1, column: 0, category: "quality", severity: "low",
      title: "Missing <!DOCTYPE html>",
      message: "Without a doctype, browsers fall back to 'quirks mode' and render layouts inconsistently.",
      suggestion: "Add <!DOCTYPE html> as the first line.",
      patches: [{ op: "insert", line: 1, text: "<!DOCTYPE html>" }],
    });
  }

  // Embedded scripts and styles
  for (const b of blocks) {
    if (b.closeLine - b.openLine < 2) continue;
    const inner = ctx.lines.slice(b.openLine, b.closeLine - 1).join("\n");
    if (!inner.trim()) continue;
    const sub = b.kind === "script" ? scanJavaScript(inner) : scanCss(inner);
    for (const i of sub) {
      const shifted: Issue = {
        ...i,
        id: `${b.kind}-${i.id}`,
        line: i.line + b.openLine,
        title: `${i.title} (in <${b.kind}>)`,
      };
      if (i.patches) shifted.patches = i.patches.map((p) => ({ ...p, line: p.line + b.openLine }));
      ctx.issues.push(shifted);
    }
  }
  return ctx.issues;
}
