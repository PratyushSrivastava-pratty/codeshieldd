import { mask } from "./tokenize";
import { checkBrackets, checkSecrets, checkUnterminated, typoCheck } from "./common";
import { Ctx } from "./util";
import type { Issue, Patch } from "./types";

const TYPOS: Record<string, string> = {
  ocut: "cout", cuot: "cout", cotu: "cout", coutt: "cout", cni: "cin", cinn: "cin",
  edl: "endl", endll: "endl", enld: "endl",
  retrun: "return", retun: "return", reutrn: "return", returm: "return",
  itn: "int", viod: "void", vodi: "void", mian: "main", mani: "main",
  inculde: "include", incldue: "include", inlcude: "include", incude: "include", includ: "include",
  pritnf: "printf", prinft: "printf", printff: "printf", scnaf: "scanf",
  strign: "string", stirng: "string", sting: "string", flaot: "float", doubel: "double", cahr: "char",
  ture: "true", flase: "false", True: "true", False: "false",
  namepsace: "namespace", namspace: "namespace", usign: "using", uisng: "using",
  whiel: "while", whlie: "while", esle: "else", swtich: "switch", vecotr: "vector", vetor: "vector",
};

const HEADER_END = /^(\}\s*)?(if|for|while|else\s+if|switch|catch)\b.*\)$/;
const BARE_KEYWORD = /^(\}\s*)?(else|do|try)$/;
const CONTINUES_NEXT = /^(\{|<<|>>|\.|->|\?|:|\+|-(?!-)|\*|\/|%|=|&|\||\^|,|\)|\]|<|>)/;

function hasInclude(ctx: Ctx, names: string[]): boolean {
  return ctx.lines.some((l) => {
    const m = /^\s*#\s*include\s*[<"]([^>"]+)[>"]/.exec(l);
    return !!m && (names.includes(m[1] ?? "") || m[1] === "bits/stdc++.h");
  });
}

export function scanCpp(code: string): Issue[] {
  const { masked, unterminated } = mask(code, {
    lineComments: ["//"],
    blockComments: [["/*", "*/"]],
    quotes: ['"', "'"],
  });
  const ctx = new Ctx(code.split("\n"), masked.split("\n"), "cpp");
  checkUnterminated(ctx, unterminated);
  const skip = new Set(unterminated.map((u) => u.line));
  checkBrackets(ctx, masked, skip);
  checkSecrets(ctx);
  typoCheck(ctx, TYPOS, { requireNext: { mian: /^\s*\(/, mani: /^\s*\(/, sting: /^\s+\w/ } });

  // Brace kinds per line end
  type Frame = { ch: string; kind: "block" | "init" | "type" | "paren"; line: number; col: number };
  const stack: Frame[] = [];
  const endState: { parenDepth: number; inInit: boolean }[] = [];
  const typeCloses: { line: number; col: number; idx: number }[] = [];
  let prevSig = "";
  let line = 1;
  let col = 0;
  for (let i = 0; i < masked.length; i++) {
    const c = masked[i] ?? "";
    if (c === "\n") {
      endState.push({ parenDepth: stack.filter((f) => f.kind === "paren").length, inInit: stack.some((f) => f.kind === "init") });
      line++;
      col = 0;
      continue;
    }
    if (c === "{") {
      const here = ctx.mline(line).slice(0, col);
      const prevLine = here.trim() === "" ? ctx.mline(ctx.prevCodeLine(line)) : here;
      let kind: Frame["kind"] = "block";
      if (prevSig !== "" && "=,({[".includes(prevSig)) kind = "init";
      else if (/\benum\b/.test(prevLine)) kind = "init";
      else if (/\b(class|struct|union)\b/.test(prevLine) && !/\(/.test(prevLine)) kind = "type";
      stack.push({ ch: c, kind, line, col });
    } else if (c === "(" || c === "[") stack.push({ ch: c, kind: "paren", line, col });
    else if (c === "}" || c === ")" || c === "]") {
      const f = stack.pop();
      if (c === "}" && f && (f.kind === "type" || (f.kind === "init" && /\benum\b/.test(ctx.mline(f.line) + ctx.mline(f.line - 1))))) {
        typeCloses.push({ line, col, idx: i });
      }
    }
    if (!/\s/.test(c)) prevSig = c;
    col++;
  }
  endState.push({ parenDepth: 0, inInit: false });

  for (const tc of typeCloses) {
    const rest = masked.slice(tc.idx + 1);
    const declares = /^\s*;/.test(rest) || /^\s*[*&]?\s*(?!(?:void|int|char|float|double|bool|long|short|auto|const|static|class|struct|enum|union|namespace|template|using|return|typedef)\b)[A-Za-z_]\w*\s*(;|,|=|\[|\{)/.test(rest);
    if (!declares) {
      ctx.add({
        rule: "missing-semicolon-type", line: tc.line, column: tc.col, category: "syntax", severity: "high",
        title: "Missing ; after class/struct",
        message: "In C++ a class, struct or enum definition must end with }; — the semicolon is required.",
        suggestion: 'Add ";" right after the closing brace.',
        patches: [ctx.insertAt(tc.line, tc.col + 1, ";")],
      });
    }
  }

  const usesStdNames = /(?<![\w:])(cout|cin|endl|cerr|string|vector)\b/;
  const hasUsing = ctx.mlines.some((l) => /using\s+namespace\s+std\s*;/.test(l));
  let usingFlagged = false;
  const arrays = new Map<string, string>();
  const newArrays = new Set<string>();

  for (let n = 1; n <= ctx.lineCount; n++) {
    const m = ctx.mline(n);
    const t = m.trim();
    const raw = ctx.line(n);
    if (!t || skip.has(n)) continue;
    const st = endState[n - 1];
    if (t.startsWith("#")) {
      const bad = /^(\s*#\s*include\s*)<(\w+)\.h>/.exec(raw);
      if (bad && ["iostream", "fstream", "string", "vector", "iomanip"].includes(bad[2] ?? "")) {
        ctx.add({
          rule: "old-header", line: n, column: 0, category: "syntax", severity: "high",
          title: `<${bad[2]}.h> doesn't exist`,
          message: `Modern C++ headers have no .h — the file is <${bad[2]}>.`,
          suggestion: `Use #include <${bad[2]}>.`,
          patches: [{ op: "replace", line: n, text: raw.replace(`<${bad[2]}.h>`, `<${bad[2]}>`) }],
        });
      }
      const bare = /^(\s*#\s*include\s+)([\w./]+)\s*$/.exec(raw);
      if (bare) {
        ctx.add({
          rule: "include-brackets", line: n, column: 0, category: "syntax", severity: "high",
          title: "#include needs < > or quotes",
          message: "The header name must be wrapped in <angle brackets> or \"quotes\".",
          suggestion: `#include <${bare[2]}>`,
          patches: [{ op: "replace", line: n, text: `${bare[1]}<${bare[2]}>` }],
        });
      }
      continue;
    }

    // Missing semicolons
    if (st && st.parenDepth === 0 && !st.inInit && !/^template\s*</.test(t) && !t.endsWith("\\")) {
      const last = t[t.length - 1] ?? "";
      const complete = /[\w'")\]]/.test(last) || /(\+\+|--)$/.test(t);
      const isAccess = /^(public|private|protected)\s*:?$/.test(t);
      if (complete && !isAccess && !HEADER_END.test(t) && !BARE_KEYWORD.test(t) && !/^(\}\s*)?(else|case\b|default\b)/.test(t)) {
        const next = ctx.nextCodeLine(n);
        const nt = next > 0 ? ctx.mline(next).trim() : "";
        if (!CONTINUES_NEXT.test(nt) && !/^(class|struct|union|enum|namespace)\b/.test(t)) {
          ctx.add({
            rule: "missing-semicolon", line: n, column: ctx.contentEnd(n), category: "syntax", severity: "high",
            title: "Missing semicolon",
            message: "Every C++ statement must end with ;. The compiler error usually points at the NEXT line, which makes this one sneaky.",
            suggestion: 'Add ";" at the end of the line.',
            patches: [ctx.appendToContent(n, ";")],
          });
        }
      }
    }

    // void main
    const vm = /\bvoid\s+main\s*\(/.exec(m);
    if (vm) {
      ctx.add({
        rule: "void-main", line: n, column: vm.index, category: "bug", severity: "medium",
        title: "main must return int",
        message: "Standard C++ requires int main(). void main() fails on many compilers.",
        suggestion: "Use int main().",
        patches: [ctx.replaceRange(n, vm.index, 4, "int")],
      });
    }

    // std names without std::
    const sn = usesStdNames.exec(m);
    if (sn && !hasUsing && !usingFlagged && !/\b(struct|class)\s+(string|vector)\b/.test(m)) {
      usingFlagged = true;
      let lastInclude = 0;
      ctx.lines.forEach((l, i) => {
        if (/^\s*#\s*include/.test(l)) lastInclude = i + 1;
      });
      ctx.add({
        rule: "missing-std", line: n, column: sn.index, category: "syntax", severity: "high",
        title: `"${sn[1]}" was not declared in this scope`,
        message: `${sn[1]} lives in the std namespace. Without std:: or "using namespace std;" the compiler can't find it.`,
        suggestion: `Write std::${sn[1]} or add "using namespace std;" after your includes.`,
        patches: [{ op: "insert", line: lastInclude + 1, text: "using namespace std;" }],
      });
    }

    // Unsafe C functions
    const gets = /(?<![\w.])gets\s*\(\s*([\w]+)\s*\)/.exec(m);
    if (gets) {
      ctx.add({
        rule: "gets", line: n, column: gets.index, category: "security", severity: "high",
        title: "gets() causes buffer overflows",
        message: "gets() has no size limit, so long input overwrites memory. It was removed from the language for this reason.",
        suggestion: `Use fgets(${gets[1]}, sizeof(${gets[1]}), stdin).`,
        patches: [ctx.replaceRange(n, gets.index, gets[0].length, `fgets(${gets[1]}, sizeof(${gets[1]}), stdin)`)],
      });
    }
    const sc = /(?<![\w.])(strcpy|strcat|sprintf)\s*\(\s*([\w]+)\s*,/.exec(m);
    if (sc) {
      const fn = sc[1] ?? "";
      const dst = sc[2] ?? "";
      const open = m.indexOf("(", sc.index);
      let d = 0;
      let close = -1;
      for (let k = open; k < m.length; k++) {
        if (m[k] === "(") d++;
        else if (m[k] === ")" && --d === 0) { close = k; break; }
      }
      const patches: Patch[] = [];
      if (close > 0) {
        const args = raw.slice(open + 1, close);
        const rest = args.slice(args.indexOf(",") + 1).trim();
        const repl =
          fn === "strcpy" ? `strncpy(${dst}, ${rest}, sizeof(${dst}) - 1)`
          : fn === "strcat" ? `strncat(${dst}, ${rest}, sizeof(${dst}) - strlen(${dst}) - 1)`
          : `snprintf(${dst}, sizeof(${dst}), ${rest})`;
        patches.push(ctx.replaceRange(n, sc.index, close - sc.index + 1, repl));
      }
      ctx.add({
        rule: "unsafe-c-string", line: n, column: sc.index, category: "security", severity: "high",
        title: `${fn}() can overflow the buffer`,
        message: `${fn}() doesn't check the size of "${dst}". Longer input overwrites nearby memory — a classic exploit.`,
        suggestion: `Use the size-limited version (${fn === "sprintf" ? "snprintf" : fn.replace("str", "strn")}) or std::string.`,
        patches,
      });
    }
    const sys = /(?<![\w.:])system\s*\(/.exec(m);
    if (sys) {
      ctx.add({
        rule: "system-call", line: n, column: sys.index, category: "security", severity: "high",
        title: "system() runs shell commands",
        message: "system() passes text to the shell. If any part comes from input, attackers can run their own commands.",
        suggestion: "Remove it and do the work directly in C++.",
        patches: [{ op: "replace", line: n, text: raw.replace(/^(\s*)(.*)$/, "$1// removed unsafe system() call: $2") }],
      });
    }

    // Assignment in condition
    const cond = /\b(if|while)\s*\(/.exec(m);
    if (cond) {
      const open = cond.index + cond[0].length - 1;
      let d = 0;
      for (let k = open; k < m.length; k++) {
        const c = m[k];
        if (c === "(") d++;
        else if (c === ")") {
          if (--d === 0) break;
        } else if (c === "=" && d === 1 && !"=!<>+-*/%&|^".includes(m[k - 1] ?? "") && m[k + 1] !== "=") {
          ctx.add({
            rule: "assign-in-condition", line: n, column: k, category: "bug", severity: "high",
            title: '"=" used instead of "=="',
            message: "A single = assigns a value, so this condition changes your variable and is almost always true.",
            suggestion: 'Use "==" to compare.',
            patches: [ctx.replaceRange(n, k, 1, "==")],
          });
          break;
        }
      }
    }

    // Wrong stream operator
    for (const hit of m.matchAll(/\b(cin\s*<<|cout\s*>>)/g)) {
      const isCin = (hit[1] ?? "").startsWith("cin");
      const k = (hit.index ?? 0) + (hit[1] ?? "").length - 2;
      ctx.add({
        rule: "stream-operator", line: n, column: k, category: "syntax", severity: "high",
        title: isCin ? "cin uses >>" : "cout uses <<",
        message: isCin ? "Input flows from cin INTO the variable: cin >> x." : "Output flows INTO cout: cout << x.",
        suggestion: isCin ? "Use >>." : "Use <<.",
        patches: [ctx.replaceRange(n, k, 2, isCin ? ">>" : "<<")],
      });
    }

    // Track arrays
    for (const a of m.matchAll(/\b(?:int|char|float|double|long|short|bool|string)\s+(\w+)\s*\[\s*(\d+)\s*\]/g)) {
      if (a[1] && a[2]) arrays.set(a[1], a[2]);
    }
    for (const a of m.matchAll(/\b(\w+)\s*=\s*new\s+[\w:<>]+\s*\[/g)) if (a[1]) newArrays.add(a[1]);
    const del = /\bdelete\s+(\w+)/.exec(m);
    if (del && del[1] && newArrays.has(del[1])) {
      ctx.add({
        rule: "delete-array", line: n, column: del.index, category: "bug", severity: "high",
        title: "Use delete[] for arrays",
        message: `"${del[1]}" was created with new[], so it must be freed with delete[]. Plain delete is undefined behaviour.`,
        suggestion: `delete[] ${del[1]};`,
        patches: [ctx.replaceRange(n, del.index, 6, "delete[]")],
      });
    }
    const loop = /\bfor\s*\(.*?;\s*\w+\s*(<=)\s*(\w+(?:\.size\(\))?)\s*;/.exec(m);
    if (loop) {
      const bound = loop[2] ?? "";
      const isSize = bound.endsWith(".size()");
      const matches = isSize || [...arrays.values()].includes(bound);
      if (matches) {
        const k = m.indexOf("<=", loop.index);
        ctx.add({
          rule: "off-by-one", line: n, column: k, category: "bug", severity: "high",
          title: "Off-by-one: reads past the array",
          message: `Indexes go from 0 to ${isSize ? "size() - 1" : `${bound} - 1`}. "<=" reads one slot past the end — memory you don't own.`,
          suggestion: 'Use "<" instead of "<=".',
          patches: [ctx.replaceRange(n, k, 2, "<")],
        });
      }
    }
  }

  // Missing headers
  const all = ctx.mlines.join("\n");
  const needs: [RegExp, string[], string][] = [
    [/\b(std::)?(cout|cin|cerr|endl)\b/, ["iostream"], "iostream"],
    [/\b(std::)?vector\s*</, ["vector"], "vector"],
    [/\b(printf|scanf|fgets|puts)\s*\(/, ["cstdio", "stdio.h", "iostream"], "cstdio"],
    [/\b(strlen|strncpy|strncat|strcmp|strcpy|strcat)\s*\(/, ["cstring", "string.h"], "cstring"],
    [/\b(sqrt|pow|floor|ceil|fabs)\s*\(/, ["cmath", "math.h"], "cmath"],
  ];
  for (const [re, headers, add] of needs) {
    const hit = re.exec(all);
    if (hit && !hasInclude(ctx, headers)) {
      const before = all.slice(0, hit.index);
      const ln = before.split("\n").length;
      ctx.add({
        rule: "missing-include", line: ln, column: 0, category: "syntax", severity: "high",
        title: `Missing #include <${add}>`,
        message: `"${hit[0].replace(/\s*[(<]$/, "")}" comes from the <${add}> header, which isn't included.`,
        suggestion: `Add #include <${add}> at the top.`,
        patches: [{ op: "insert", line: 1, text: `#include <${add}>` }],
      });
    }
  }
  return ctx.issues;
}
