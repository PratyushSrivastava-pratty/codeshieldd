import { mask } from "./tokenize";
import { checkBrackets, checkSecrets, checkUnterminated, typoCheck } from "./common";
import { Ctx } from "./util";
import type { Issue } from "./types";

const TYPOS: Record<string, string> = {
  fucntion: "function", funtion: "function", functoin: "function", fuction: "function", funciton: "function", fnction: "function",
  cosnt: "const", conts: "const", csont: "const", cont: "const",
  retrun: "return", reutrn: "return", retun: "return", returm: "return",
  consle: "console", cosole: "console", conosle: "console", consloe: "console", colsole: "console",
  lenght: "length", lengh: "length", legnth: "length",
  docuemnt: "document", documnet: "document", doucment: "document", dcoument: "document",
  widnow: "window", windwo: "window",
  ture: "true", flase: "false", fasle: "false", udefined: "undefined", undefinded: "undefined", undefind: "undefined",
  querySelecter: "querySelector", getElementByID: "getElementById", getElementsById: "getElementById",
  addEventListner: "addEventListener", addEventListiner: "addEventListener", addEvenListener: "addEventListener",
  esle: "else", swtich: "switch", awiat: "await", asnyc: "async", improt: "import", exoprt: "export",
  True: "true", False: "false", None: "null", elif: "else if",
};

const HEADER_END = /^(\}\s*)?(if|for|while|else\s+if|with|switch|catch)\b.*\)$/;
const BARE_KEYWORD = /^(\}\s*)?(else|do|try|finally)$/;
const CONTINUES_NEXT = /^(\.|\?|:|\+|-(?!-)|\*|\/|%|=|&|\||\^|,|>|<|\)|\]|in\b|instanceof\b)/;

export function scanJavaScript(code: string): Issue[] {
  const { masked, unterminated } = mask(code, {
    lineComments: ["//"],
    blockComments: [["/*", "*/"]],
    quotes: ['"', "'"],
    template: true,
    regex: true,
  });
  const ctx = new Ctx(code.split("\n"), masked.split("\n"), "javascript");
  checkUnterminated(ctx, unterminated);
  const skip = new Set(unterminated.map((u) => u.line));
  checkBrackets(ctx, masked, skip);
  checkSecrets(ctx);
  typoCheck(ctx, TYPOS, { requireNext: { cont: /^\s+[\w$]+\s*=/ } });

  // Bracket state per line end (for semicolon analysis)
  type Frame = { ch: string; kind: "block" | "object" | "paren"; assign: boolean };
  const stack: Frame[] = [];
  const endState: { parenDepth: number; inObject: boolean; closedAssignObject: boolean }[] = [];
  let closedAssign = false;
  let prevSig = "";
  let prevWord = "";
  let word = "";
  for (const c of masked) {
    if (c === "\n") {
      endState.push({
        parenDepth: stack.filter((f) => f.kind === "paren").length,
        inObject: stack[stack.length - 1]?.kind === "object",
        closedAssignObject: closedAssign,
      });
      closedAssign = false;
      continue;
    }
    if (/[\w$]/.test(c)) word += c;
    else if (word) {
      prevWord = word;
      word = "";
    }
    if (c === "{") {
      const isObj =
        (prevSig !== "" && "=(,:[?".includes(prevSig)) ||
        (prevWord === "return" && prevSig === "n") ||
        (prevWord === "default" && prevSig === "t");
      stack.push({ ch: c, kind: isObj ? "object" : "block", assign: prevSig === "=" });
    } else if (c === "(" || c === "[") stack.push({ ch: c, kind: "paren", assign: false });
    else if (c === "}" || c === ")" || c === "]") {
      const f = stack.pop();
      closedAssign = c === "}" && !!f?.assign;
    } else if (!/\s/.test(c)) closedAssign = false;
    if (!/\s/.test(c)) prevSig = c;
  }
  endState.push({ parenDepth: 0, inObject: false, closedAssignObject: closedAssign });

  const consts = new Map<string, number>();
  const reassigned = new Set<string>();

  for (let n = 1; n <= ctx.lineCount; n++) {
    const m = ctx.mline(n);
    const t = m.trim();
    if (!t || skip.has(n)) continue;
    const st = endState[n - 1];

    // Missing semicolons
    if (st && st.parenDepth === 0 && !st.inObject && !t.startsWith("@")) {
      const last = t[t.length - 1] ?? "";
      const complete = /[\w$'"`)\]]/.test(last) || /(\+\+|--)$/.test(t) || (last === "}" && st.closedAssignObject);
      if (complete && !HEADER_END.test(t) && !BARE_KEYWORD.test(t) && !/^(\}\s*)?(else|case\b|default\b)/.test(t)) {
        const next = ctx.nextCodeLine(n);
        const nt = next > 0 ? ctx.mline(next).trim() : "";
        const continues = nt.startsWith("{") || CONTINUES_NEXT.test(nt);
        if (!continues) {
          ctx.add({
            rule: "missing-semicolon", line: n, column: ctx.contentEnd(n), category: "syntax", severity: "high",
            title: "Missing semicolon",
            message: "This statement doesn't end with a semicolon. JavaScript tries to guess where statements end, and sometimes guesses wrong.",
            suggestion: 'Add ";" at the end of the line.',
            patches: [ctx.appendToContent(n, ";")],
          });
        }
      }
    }

    // eval / new Function / string timers
    for (const hit of m.matchAll(/(?<![\w$.])eval\s*\(/g)) {
      const k = hit.index ?? 0;
      ctx.add({
        rule: "dangerous-eval", line: n, column: k, category: "security", severity: "high",
        title: "Dangerous eval() call",
        message: "eval() runs any text as code. If attackers control that text, they control your app.",
        suggestion: "Parse data with JSON.parse() instead.",
        patches: [ctx.replaceRange(n, k, 4, "JSON.parse")],
      });
    }
    const nf = /\bnew\s+Function\s*\(/.exec(m);
    if (nf) {
      ctx.add({
        rule: "new-function", line: n, column: nf.index, category: "security", severity: "high",
        title: "new Function() runs strings as code",
        message: "Like eval(), new Function() turns text into executable code.",
        suggestion: "Write a normal function instead of building one from a string.",
      });
    }
    const tm = /\b(setTimeout|setInterval)\s*\(\s*(["'])/.exec(m);
    if (tm) {
      ctx.add({
        rule: "string-timer", line: n, column: tm.index, category: "security", severity: "medium",
        title: `${tm[1]} with a string`,
        message: "Passing a string makes the browser eval() it.",
        suggestion: `Pass a function: ${tm[1]}(() => { ... }, delay)`,
      });
    }

    // DOM XSS sinks
    for (const hit of m.matchAll(/\.(innerHTML|outerHTML)\s*(\+?=)(?!=)/g)) {
      const k = (hit.index ?? 0) + 1;
      ctx.add({
        rule: "xss-innerhtml", line: n, column: k, category: "security", severity: "high",
        title: `XSS risk: ${hit[1]}`,
        message: `Setting ${hit[1]} with dynamic text lets attackers inject <script> tags and steal user sessions.`,
        suggestion: "Use textContent for text, or sanitise HTML with a library like DOMPurify.",
        patches: [ctx.replaceRange(n, k, (hit[1] ?? "").length, "textContent")],
      });
    }
    const iah = /\.insertAdjacentHTML\s*\(/.exec(m);
    if (iah) {
      ctx.add({
        rule: "xss-insert-html", line: n, column: iah.index + 1, category: "security", severity: "high",
        title: "XSS risk: insertAdjacentHTML",
        message: "insertAdjacentHTML parses its input as HTML, so injected scripts can run.",
        suggestion: "Use insertAdjacentText for plain text.",
        patches: [ctx.replaceRange(n, iah.index + 1, "insertAdjacentHTML".length, "insertAdjacentText")],
      });
    }
    const dw = /\bdocument\.write(ln)?\s*\(/.exec(m);
    if (dw) {
      ctx.add({
        rule: "document-write", line: n, column: dw.index, category: "security", severity: "medium",
        title: "document.write() is unsafe",
        message: "document.write() injects raw HTML and can wipe the whole page.",
        suggestion: "Use document.body.append() for text.",
        patches: [ctx.replaceRange(n, dw.index, dw[0].length - 1, "document.body.append")],
      });
    }

    // Loose equality
    for (const hit of m.matchAll(/(?<![=!<>])(==|!=)(?!=)/g)) {
      const op = hit[1] ?? "==";
      ctx.add({
        rule: "loose-equality", line: n, column: hit.index ?? 0, category: "bug", severity: "low",
        title: `Loose comparison "${op}"`,
        message: `"${op}" converts types before comparing, so 0 == "" and null == undefined are true.`,
        suggestion: `Use "${op}=" for a strict comparison.`,
        patches: [ctx.replaceRange(n, hit.index ?? 0, op.length, op + "=")],
      });
    }

    // Assignment inside condition
    const cond = /\b(if|while)\s*\(/.exec(m);
    if (cond) {
      const open = cond.index + cond[0].length - 1;
      let d = 0;
      for (let k = open; k < m.length; k++) {
        const c = m[k];
        if (c === "(") d++;
        else if (c === ")") {
          d--;
          if (d === 0) break;
        } else if (c === "=" && d === 1 && !"=!<>+-*/%&|^".includes(m[k - 1] ?? "") && m[k + 1] !== "=" && m[k + 1] !== ">") {
          ctx.add({
            rule: "assign-in-condition", line: n, column: k, category: "bug", severity: "high",
            title: '"=" used instead of "==="',
            message: "A single = assigns a value, so this condition changes the variable and is almost always true.",
            suggestion: 'Use "===" to compare.',
            patches: [ctx.replaceRange(n, k, 1, "===")],
          });
          break;
        }
      }
    }

    // var
    const v = /(?<![\w$.])var\s+/.exec(m);
    if (v) {
      ctx.add({
        rule: "no-var", line: n, column: v.index, category: "quality", severity: "low",
        title: 'Use "let" or "const" instead of "var"',
        message: '"var" ignores block scope, which causes confusing bugs in loops and if-blocks.',
        suggestion: 'Replace "var" with "let".',
        patches: [ctx.replaceRange(n, v.index, 3, "let")],
      });
    }

    // Off-by-one
    const ob = /([\w$]+)\s*<=\s*([\w$.]+)\.length\b/.exec(m);
    if (ob && /\bfor\s*\(/.test(m)) {
      const k = m.indexOf("<=", ob.index);
      ctx.add({
        rule: "off-by-one", line: n, column: k, category: "bug", severity: "medium",
        title: "Off-by-one loop",
        message: `Arrays end at index length - 1, so "<= ${ob[2]}.length" reads one item past the end (undefined).`,
        suggestion: 'Use "<" instead of "<=".',
        patches: [ctx.replaceRange(n, k, 2, "<")],
      });
    }

    // Empty catch
    const ec = /catch\s*\(\s*([\w$]+)\s*\)\s*\{\s*\}/.exec(m);
    if (ec) {
      const brace = m.indexOf("{", ec.index);
      const close = m.indexOf("}", brace);
      ctx.add({
        rule: "empty-catch", line: n, column: ec.index, category: "quality", severity: "low",
        title: "Empty catch block",
        message: "Errors caught here vanish silently, making bugs very hard to find.",
        suggestion: "At least log the error.",
        patches: [ctx.replaceRange(n, brace, close - brace + 1, `{ console.error(${ec[1]}); }`)],
      });
    }

    // debugger
    const dbg = /(?<![\w$.])debugger\s*;?/.exec(m);
    if (dbg) {
      const rest = (ctx.line(n).slice(0, dbg.index) + ctx.line(n).slice(dbg.index + dbg[0].length)).trim();
      ctx.add({
        rule: "debugger", line: n, column: dbg.index, category: "quality", severity: "low",
        title: "Leftover debugger statement",
        message: "debugger pauses the app for anyone with dev tools open.",
        suggestion: "Remove it before shipping.",
        patches: [rest === "" ? { op: "delete", line: n } : ctx.replaceRange(n, dbg.index, dbg[0].length, "")],
      });
    }

    // print() habit
    const pr = /(?<![\w$.])print\s*\(\s*[^)\s]/.exec(m);
    if (pr) {
      ctx.add({
        rule: "print-call", line: n, column: pr.index, category: "bug", severity: "medium",
        title: "print() opens the print dialog",
        message: "In JavaScript, print() prints the web page. To log a value use console.log().",
        suggestion: "Use console.log().",
        patches: [ctx.replaceRange(n, pr.index, 5, "console.log")],
      });
    }

    // Insecure fetch
    const hf = /\bfetch\s*\(\s*["'`]http:\/\/(?!localhost|127\.0\.0\.1)/.exec(ctx.line(n));
    if (hf) {
      const k = ctx.line(n).indexOf("http://", hf.index);
      ctx.add({
        rule: "insecure-http", line: n, column: k, category: "security", severity: "medium",
        title: "Insecure HTTP request",
        message: "Data sent over http:// can be read or changed by anyone on the same Wi-Fi.",
        suggestion: "Use https://.",
        patches: [ctx.replaceRange(n, k, 7, "https://")],
      });
    }

    // const reassignment tracking
    const cd = /\bconst\s+([\w$]+)\s*=/.exec(m);
    if (cd && cd[1] && !consts.has(cd[1])) consts.set(cd[1], n);
    const asg = /^\s*([\w$]+)\s*(=(?!=)|\+=|-=|\*=|\/=|\+\+|--)/.exec(m);
    if (asg && asg[1] && consts.has(asg[1]) && !reassigned.has(asg[1]) && !/^\s*(const|let|var)\b/.test(m)) {
      const name = asg[1];
      const declLine = consts.get(name) ?? 1;
      reassigned.add(name);
      const dl = ctx.mline(declLine);
      const k = dl.search(new RegExp(`\\bconst\\s+${name.replace(/\$/g, "\\$")}\\b`));
      ctx.add({
        rule: "const-reassign", line: n, column: asg.index, category: "bug", severity: "high",
        title: `Assignment to constant "${name}"`,
        message: `"${name}" was declared with const on line ${declLine}, so changing it here throws a TypeError.`,
        suggestion: `Declare it with let instead of const.`,
        patches: k >= 0 ? [ctx.replaceRange(declLine, k, 5, "let")] : [],
      });
    }
  }
  return ctx.issues;
}
