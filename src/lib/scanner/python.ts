import { mask } from "./tokenize";
import { checkBrackets, checkSecrets, checkUnterminated, typoCheck } from "./common";
import { Ctx, indentOf, indentWidth, lineDepths, matchParen } from "./util";
import type { Issue, Patch } from "./types";

const HEADER = /^\s*(?:async\s+)?(if|elif|else|for|while|def|class|try|except|finally|with)\b/;
const TYPOS: Record<string, string> = {
  pritn: "print", prnit: "print", pirnt: "print", prnt: "print", prinnt: "print", pint: "print",
  retrun: "return", reutrn: "return", retun: "return", returm: "return",
  improt: "import", imoprt: "import", ipmort: "import",
  whiel: "while", whlie: "while", wihle: "while",
  esle: "else", eles: "else", elfi: "elif", elsif: "elif", eilf: "elif",
  calss: "class", clas: "class", deff: "def", dfe: "def",
  rnage: "range", ragne: "range", rang: "range",
  lenght: "len", lengh: "len", inptu: "input", inpt: "input",
  appned: "append", apend: "append", Ture: "True", Flase: "False", Nnoe: "None",
};

function topLevelColon(s: string, from: number): number {
  let d = 0;
  for (let k = from; k < s.length; k++) {
    const c = s[k];
    if (c === "(" || c === "[" || c === "{") d++;
    else if (c === ")" || c === "]" || c === "}") d--;
    else if (c === ":" && d === 0 && s[k + 1] !== "=") return k;
  }
  return -1;
}

function ensureImport(ctx: Ctx, mod: string): Patch[] {
  const re = new RegExp(`^\\s*(import\\s+([\\w.]+\\s*,\\s*)*${mod}\\b|from\\s+${mod}\\s+import)`);
  if (ctx.lines.some((l) => re.test(l))) return [];
  const at = ctx.line(1).startsWith("#!") ? 2 : 1;
  return [{ op: "insert", line: at, text: `import ${mod}` }];
}

export function scanPython(code: string): Issue[] {
  const { masked, unterminated } = mask(code, { lineComments: ["#"], quotes: ['"', "'"], triple: true });
  const ctx = new Ctx(code.split("\n"), masked.split("\n"), "python");
  checkUnterminated(ctx, unterminated);
  const skip = new Set(unterminated.filter((u) => u.kind === "string").map((u) => u.line));
  checkBrackets(ctx, masked, skip);
  checkSecrets(ctx);
  typoCheck(ctx, TYPOS);
  const depth = lineDepths(masked);
  const missingColon = new Set<number>();

  for (let n = 1; n <= ctx.lineCount; n++) {
    const m = ctx.mline(n);
    const mt = m.replace(/\s+$/, "");
    const raw = ctx.line(n);
    if (mt.trim() === "" || skip.has(n)) continue;
    const startDepth = depth.start[n - 1] ?? 0;
    const endDepth = depth.end[n - 1] ?? 0;

    // else if -> elif
    const elseIf = /^(\s*)else\s+if\b/.exec(mt);
    if (elseIf && startDepth === 0) {
      const ind = elseIf[1] ?? "";
      ctx.add({
        rule: "else-if", line: n, column: ind.length, category: "syntax", severity: "high",
        title: '"else if" is not Python',
        message: 'Python spells "else if" as one keyword: elif.',
        suggestion: 'Replace "else if" with "elif".',
        patches: [ctx.replaceRange(n, ind.length, (elseIf[0] ?? "").length - ind.length, "elif")],
      });
      continue;
    }

    // Block header missing colon
    const h = HEADER.exec(mt);
    if (h && startDepth === 0 && endDepth === 0 && !mt.endsWith("\\")) {
      if (topLevelColon(mt, h[0].length) === -1) {
        missingColon.add(n);
        ctx.add({
          rule: "missing-colon", line: n, column: mt.length, category: "syntax", severity: "high",
          title: `Missing ":" after ${h[1]}`,
          message: `In Python every "${h[1]}" line must end with a colon before its indented block.`,
          suggestion: 'Add ":" at the end of the line.',
          patches: [ctx.appendToContent(n, ":")],
        });
      }
    }

    // Python 2 print
    const p2 = /^(\s*)print\s+([^\s(=.,)\[])/.exec(mt);
    if (p2 && startDepth === 0) {
      const ind = p2[1] ?? "";
      const argStart = mt.indexOf(p2[2] ?? "", ind.length + 5);
      const args = raw.slice(argStart, mt.length).trimEnd();
      ctx.add({
        rule: "print-statement", line: n, column: ind.length, category: "syntax", severity: "high",
        title: "print needs parentheses",
        message: "This is Python 2 syntax. In Python 3, print is a function and must be called with ( ).",
        suggestion: `Use print(${args}).`,
        patches: [{ op: "replace", line: n, text: `${ind}print(${args})${raw.slice(mt.length)}` }],
      });
    }

    // Assignment inside a condition
    const cond = /^\s*(if|elif|while)\b/.exec(mt);
    if (cond && startDepth === 0) {
      const end = topLevelColon(mt, cond[0].length);
      const stop = end === -1 ? mt.length : end;
      let d = 0;
      for (let k = cond[0].length; k < stop; k++) {
        const c = mt[k];
        if (c === "(" || c === "[" || c === "{") d++;
        else if (c === ")" || c === "]" || c === "}") d--;
        else if (c === "=" && d === 0 && !"=!<>:+-*/%&|^".includes(mt[k - 1] ?? "") && mt[k + 1] !== "=") {
          ctx.add({
            rule: "assign-in-condition", line: n, column: k, category: "bug", severity: "high",
            title: '"=" used instead of "=="',
            message: 'A single "=" assigns a value. To compare two values inside a condition you need "==".',
            suggestion: 'Change "=" to "==".',
            patches: [ctx.replaceRange(n, k, 1, "==")],
          });
          break;
        }
      }
    }

    // JS habits
    for (const hit of mt.matchAll(/&&|\|\||!(?!=)/g)) {
      const op = hit[0];
      const rep = op === "&&" ? "and" : op === "||" ? "or" : "not ";
      const k = hit.index ?? 0;
      const padded = op === "!" ? rep : ` ${rep} `;
      const before = raw.slice(0, k).replace(/\s+$/, "");
      const after = raw.slice(k + op.length).replace(/^\s+/, "");
      ctx.add({
        rule: "js-operator", line: n, column: k, category: "syntax", severity: "high",
        title: `"${op}" is not a Python operator`,
        message: `Python uses words for logic: "and", "or", "not".`,
        suggestion: `Replace "${op}" with "${rep.trim()}".`,
        patches: [{ op: "replace", line: n, text: op === "!" ? raw.slice(0, k) + rep + after : before + padded + after }],
      });
      break;
    }

    // true / false / null
    for (const hit of mt.matchAll(/(?<![\w.])(true|false|null|none|nil)(?!\w)(?!\s*=(?!=))/g)) {
      const w = hit[1] ?? "";
      const fix = w === "true" ? "True" : w === "false" ? "False" : "None";
      ctx.add({
        rule: "wrong-literal", line: n, column: hit.index ?? 0, category: "bug", severity: "high",
        title: `"${w}" is not defined in Python`,
        message: `Python's built-in value is spelled "${fix}" (capitalised). "${w}" raises a NameError.`,
        suggestion: `Use ${fix}.`,
        patches: [ctx.replaceRange(n, hit.index ?? 0, w.length, fix)],
      });
    }

    // eval / exec
    for (const hit of mt.matchAll(/(?<![\w.])(eval|exec)\s*\(/g)) {
      const fn = hit[1] ?? "";
      const k = hit.index ?? 0;
      ctx.add({
        rule: `dangerous-${fn}`, line: n, column: k, category: "security", severity: "high",
        title: `Dangerous ${fn}() call`,
        message: `${fn}() runs any text as Python code. If that text comes from a user, they can delete files or steal data.`,
        suggestion: fn === "eval" ? "Use ast.literal_eval() to safely parse values." : "Remove exec() and call the function you need directly.",
        patches:
          fn === "eval"
            ? [ctx.replaceRange(n, k, 4, "ast.literal_eval"), ...ensureImport(ctx, "ast")]
            : [{ op: "replace", line: n, text: `${indentOf(raw)}pass  # removed unsafe exec() call` }],
      });
    }

    // os.system / shell=True
    const sys = /\bos\.system\s*\(/.exec(mt);
    if (sys) {
      const open = sys.index + sys[0].length - 1;
      const close = matchParen(mt, open);
      const patches: Patch[] = [];
      if (close > 0) {
        patches.push(
          { op: "replace", line: n, text: raw.slice(0, sys.index) + "subprocess.run(shlex.split(" + raw.slice(open + 1, close) + "), check=True)" + raw.slice(close + 1) },
          ...ensureImport(ctx, "subprocess"),
          ...ensureImport(ctx, "shlex"),
        );
      }
      ctx.add({
        rule: "os-system", line: n, column: sys.index, category: "security", severity: "high",
        title: "Shell command injection risk",
        message: "os.system() hands the whole string to the shell. Anything a user types into it can run extra commands.",
        suggestion: "Use subprocess.run() with a list of arguments.",
        patches,
      });
    }
    const shell = /shell\s*=\s*True/.exec(mt);
    if (shell) {
      ctx.add({
        rule: "shell-true", line: n, column: shell.index, category: "security", severity: "high",
        title: "subprocess with shell=True",
        message: "shell=True lets special characters in the command run extra programs.",
        suggestion: "Use shell=False and pass the command as a list.",
        patches: [ctx.replaceRange(n, shell.index, shell[0].length, "shell=False")],
      });
    }
    const pk = /\bpickle\.(loads?)\s*\(/.exec(mt);
    if (pk) {
      ctx.add({
        rule: "pickle", line: n, column: pk.index, category: "security", severity: "medium",
        title: "Unsafe pickle loading",
        message: "Loading pickle data from an untrusted source can execute hidden code.",
        suggestion: "Use json for data you receive from others.",
        patches: [ctx.replaceRange(n, pk.index, 7 + (pk[1] ?? "").length, `json.${pk[1]}`), ...ensureImport(ctx, "json")],
      });
    }
    const ym = /\byaml\.load\s*\(/.exec(mt);
    if (ym && !/SafeLoader/.test(raw)) {
      ctx.add({
        rule: "yaml-load", line: n, column: ym.index, category: "security", severity: "medium",
        title: "Unsafe yaml.load()",
        message: "yaml.load() can build arbitrary Python objects from a file.",
        suggestion: "Use yaml.safe_load().",
        patches: [ctx.replaceRange(n, ym.index, 9, "yaml.safe_load")],
      });
    }
    if (/\.execute\s*\(/.test(mt)) {
      const after = raw.slice(mt.search(/\.execute\s*\(/));
      if (/\bf["']/.test(after) || /["']\s*(%|\+)/.test(after) || /\.format\(/.test(after)) {
        ctx.add({
          rule: "sql-injection", line: n, column: mt.search(/\.execute/), category: "security", severity: "high",
          title: "SQL injection risk",
          message: "The SQL query is built by gluing strings together. A user could type SQL that reads or deletes your whole database.",
          suggestion: 'Pass values separately: cursor.execute("SELECT * FROM users WHERE id = %s", (user_id,))',
        });
      }
    }

    // Bare except
    const ex = /^(\s*)except\s*:/.exec(mt);
    if (ex) {
      const ind = ex[1] ?? "";
      ctx.add({
        rule: "bare-except", line: n, column: ind.length, category: "quality", severity: "low",
        title: "Bare except catches everything",
        message: 'A plain "except:" also swallows Ctrl+C and typos, hiding real bugs.',
        suggestion: 'Catch "Exception" (or something more specific).',
        patches: [ctx.replaceRange(n, ind.length, (ex[0] ?? "").length - ind.length, "except Exception:")],
      });
    }
    for (const hit of mt.matchAll(/(==|!=)\s*None\b/g)) {
      const rep = hit[1] === "==" ? "is None" : "is not None";
      ctx.add({
        rule: "none-compare", line: n, column: hit.index ?? 0, category: "quality", severity: "low",
        title: `Use "${rep}"`,
        message: "None should be compared with is / is not, not == / !=.",
        suggestion: `Replace with "${rep}".`,
        patches: [ctx.replaceRange(n, hit.index ?? 0, hit[0].length, rep)],
      });
    }
    for (const hit of mt.matchAll(/\bis(\s+not)?\s+(?=["'\d])/g)) {
      const rep = hit[1] ? "!= " : "== ";
      ctx.add({
        rule: "is-literal", line: n, column: hit.index ?? 0, category: "bug", severity: "medium",
        title: `"is" compares identity, not value`,
        message: '"is" checks whether two things are the same object. For strings and numbers it can randomly be False.',
        suggestion: `Use "${rep.trim()}".`,
        patches: [ctx.replaceRange(n, hit.index ?? 0, hit[0].length, rep)],
      });
    }
    const rl = /range\(\s*len\(([^()]*)\)\s*\+\s*1\s*\)/.exec(mt);
    if (rl) {
      ctx.add({
        rule: "off-by-one", line: n, column: rl.index, category: "bug", severity: "medium",
        title: "Off-by-one: index out of range",
        message: "range(len(x) + 1) goes one step past the last item, causing an IndexError.",
        suggestion: `Use range(len(${rl[1]})).`,
        patches: [ctx.replaceRange(n, rl.index, rl[0].length, `range(len(${rl[1]}))`)],
      });
    }
    const md = /^(\s*)def\s+\w+\s*\(.*?\b(\w+)\s*=\s*(\[\]|\{\}|set\(\))/.exec(mt);
    if (md && mt.endsWith(":")) {
      const p = md[2] ?? "x";
      const val = md[3] ?? "[]";
      const k = mt.indexOf(`${p}`, mt.indexOf("("));
      const eq = mt.indexOf(val, k);
      const ind = (md[1] ?? "") + "    ";
      ctx.add({
        rule: "mutable-default", line: n, column: k, category: "bug", severity: "medium",
        title: "Mutable default argument",
        message: `The default ${val} is created once and shared by every call, so values leak between calls.`,
        suggestion: `Default to None and create a new ${val} inside the function.`,
        patches: [
          ctx.replaceRange(n, eq, val.length, "None"),
          { op: "insert", line: n + 1, text: `${ind}if ${p} is None:\n${ind}    ${p} = ${val}` },
        ],
      });
    }
    if (mt.endsWith(";") && startDepth === 0) {
      ctx.add({
        rule: "semicolon", line: n, column: mt.length - 1, category: "quality", severity: "low",
        title: "Unnecessary semicolon",
        message: "Python doesn't need semicolons at the end of lines.",
        suggestion: "Remove the trailing ;",
        patches: [ctx.replaceRange(n, mt.length - 1, 1, "")],
      });
    }
  }

  // Indentation analysis
  const stack = [0];
  let prevEndsColon = false;
  let prevCode = -1;
  let prevTerminal = false;
  let prevInd = 0;
  let contLine = false;
  const usesTabs: number[] = [];
  let usesSpaces = false;
  for (let n = 1; n <= ctx.lineCount; n++) {
    const m = ctx.mline(n);
    const mt = m.replace(/\s+$/, "");
    if (mt.trim() === "") continue;
    const raw = ctx.line(n);
    const lead = indentOf(raw);
    if (lead.includes("\t")) usesTabs.push(n);
    else if (lead.length) usesSpaces = true;
    const startDepth = depth.start[n - 1] ?? 0;
    const endDepth = depth.end[n - 1] ?? 0;
    if (startDepth > 0 || contLine) {
      contLine = mt.endsWith("\\");
      if (endDepth === 0) prevEndsColon = mt.endsWith(":") || prevEndsColon;
      continue;
    }
    let ind = indentWidth(raw);
    const top = stack[stack.length - 1] ?? 0;
    const body = raw.trimStart();
    if (prevEndsColon) {
      if (ind <= top) {
        const want = top + 4;
        ctx.add({
          rule: "expected-indent", line: n, column: 0, category: "syntax", severity: "high",
          title: "IndentationError: expected an indented block",
          message: `The line before ends with ":", so this line must be indented further.`,
          suggestion: `Indent this line by ${want} spaces.`,
          patches: [{ op: "replace", line: n, text: " ".repeat(want) + body }],
        });
        ind = want;
      }
      stack.push(ind);
    } else if (ind > top) {
      ctx.add({
        rule: "unexpected-indent", line: n, column: 0, category: "syntax", severity: "high",
        title: "IndentationError: unexpected indent",
        message: "This line is indented more than the code around it, but nothing above opens a new block.",
        suggestion: `Line it up with the line above (${top} spaces).`,
        patches: [{ op: "replace", line: n, text: " ".repeat(top) + body }],
      });
      ind = top;
    } else if (ind < top) {
      while (stack.length > 1 && (stack[stack.length - 1] ?? 0) > ind) stack.pop();
      const lvl = stack[stack.length - 1] ?? 0;
      if (lvl !== ind) {
        ctx.add({
          rule: "unindent-mismatch", line: n, column: 0, category: "syntax", severity: "high",
          title: "IndentationError: unindent does not match",
          message: "This line's indentation doesn't line up with any outer block.",
          suggestion: `Indent it by ${lvl} spaces.`,
          patches: [{ op: "replace", line: n, text: " ".repeat(lvl) + body }],
        });
        ind = lvl;
      }
    }
    // Unreachable code
    if (prevTerminal && ind === prevInd && !/^\s*(elif|else|except|finally|case)\b/.test(mt) && !prevEndsColon) {
      ctx.add({
        rule: "unreachable", line: n, column: ind, category: "bug", severity: "medium",
        title: "Unreachable code",
        message: `This line can never run because the line above (line ${prevCode}) already left the block.`,
        suggestion: "Remove it or move it above the return/break.",
        patches: [{ op: "delete", line: n }],
      });
    }
    prevTerminal = /^\s*(return|break|continue|raise)\b/.test(mt);
    prevInd = ind;
    prevCode = n;
    prevEndsColon = (mt.endsWith(":") || missingColon.has(n)) && endDepth === 0;
    contLine = mt.endsWith("\\");
  }
  if (usesTabs.length && usesSpaces) {
    ctx.add({
      rule: "mixed-indent", line: usesTabs[0] ?? 1, column: 0, category: "quality", severity: "low",
      title: "Mixed tabs and spaces",
      message: "Some lines are indented with tabs and others with spaces. Python 3 treats this as an error in many cases.",
      suggestion: "Use 4 spaces everywhere.",
      patches: usesTabs.map((n) => {
        const raw = ctx.line(n);
        const lead = indentOf(raw);
        return { op: "replace", line: n, text: lead.replace(/\t/g, "    ") + raw.slice(lead.length) } as Patch;
      }),
    });
  }
  return ctx.issues;
}
