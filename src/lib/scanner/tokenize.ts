export interface Unterminated {
  line: number;
  col: number;
  kind: "string" | "comment" | "longstring";
  quote: string;
}

export interface MaskOptions {
  lineComments?: string[];
  blockComments?: [string, string][];
  quotes?: string[];
  triple?: boolean;
  template?: boolean;
  regex?: boolean;
}

export interface MaskResult {
  masked: string;
  unterminated: Unterminated[];
}

const REGEX_PREV = new Set("(,=:[!&|?{};+-*%<>~^".split(""));
const REGEX_KEYWORDS = new Set(["return", "typeof", "case", "in", "of", "delete", "void", "throw", "new", "else", "do"]);

/**
 * Replaces string contents and comments with spaces while keeping every
 * character position and newline intact. Quotes themselves are kept so rules
 * can still see "a string ended here".
 */
export function mask(code: string, o: MaskOptions): MaskResult {
  const out: string[] = [];
  const unterminated: Unterminated[] = [];
  const n = code.length;
  let i = 0;
  let line = 1;
  let col = 0;

  const emit = (keep: boolean) => {
    const ch = code[i] ?? "";
    out.push(ch === "\n" ? "\n" : keep ? ch : " ");
    if (ch === "\n") {
      line++;
      col = 0;
    } else col++;
    i++;
  };

  const prevSignificant = (): { ch: string; word: string } => {
    let k = out.length - 1;
    while (k >= 0 && /\s/.test(out[k] ?? "")) k--;
    if (k < 0) return { ch: "", word: "" };
    const ch = out[k] ?? "";
    let word = "";
    while (k >= 0 && /[\w$]/.test(out[k] ?? "")) {
      word = (out[k] ?? "") + word;
      k--;
    }
    return { ch, word };
  };

  while (i < n) {
    const ch = code[i] ?? "";

    if (o.lineComments?.some((t) => code.startsWith(t, i))) {
      while (i < n && code[i] !== "\n") emit(false);
      continue;
    }

    const blk = o.blockComments?.find(([s]) => code.startsWith(s, i));
    if (blk) {
      const [s, e] = blk;
      const sl = line;
      const sc = col;
      for (let k = 0; k < s.length; k++) emit(false);
      let closed = false;
      while (i < n) {
        if (code.startsWith(e, i)) {
          for (let k = 0; k < e.length; k++) emit(false);
          closed = true;
          break;
        }
        emit(false);
      }
      if (!closed) unterminated.push({ line: sl, col: sc, kind: "comment", quote: s });
      continue;
    }

    if (o.triple && (code.startsWith('"""', i) || code.startsWith("'''", i))) {
      const q = code.slice(i, i + 3);
      const sl = line;
      const sc = col;
      for (let k = 0; k < 3; k++) emit(true);
      let closed = false;
      while (i < n) {
        if (code[i] === "\\") {
          emit(false);
          if (i < n) emit(false);
          continue;
        }
        if (code.startsWith(q, i)) {
          for (let k = 0; k < 3; k++) emit(true);
          closed = true;
          break;
        }
        emit(false);
      }
      if (!closed) unterminated.push({ line: sl, col: sc, kind: "longstring", quote: q });
      continue;
    }

    if (o.template && ch === "`") {
      const sl = line;
      const sc = col;
      emit(true);
      let closed = false;
      while (i < n) {
        if (code[i] === "\\") {
          emit(false);
          if (i < n) emit(false);
          continue;
        }
        if (code[i] === "`") {
          emit(true);
          closed = true;
          break;
        }
        emit(false);
      }
      if (!closed) unterminated.push({ line: sl, col: sc, kind: "longstring", quote: "`" });
      continue;
    }

    if (o.quotes?.includes(ch)) {
      const sl = line;
      const sc = col;
      emit(true);
      let closed = false;
      while (i < n) {
        const c = code[i];
        if (c === "\\") {
          emit(false);
          if (i < n) emit(false);
          continue;
        }
        if (c === ch) {
          emit(true);
          closed = true;
          break;
        }
        if (c === "\n") break;
        emit(false);
      }
      if (!closed) unterminated.push({ line: sl, col: sc, kind: "string", quote: ch });
      continue;
    }

    if (o.regex && ch === "/") {
      const prev = prevSignificant();
      const looksRegex = prev.ch === "" || REGEX_PREV.has(prev.ch) || REGEX_KEYWORDS.has(prev.word);
      if (looksRegex) {
        let j = i + 1;
        let inClass = false;
        let end = -1;
        while (j < n && code[j] !== "\n") {
          const c = code[j];
          if (c === "\\") {
            j += 2;
            continue;
          }
          if (c === "[") inClass = true;
          else if (c === "]") inClass = false;
          else if (c === "/" && !inClass) {
            end = j;
            break;
          }
          j++;
        }
        if (end > i + 1) {
          emit(true);
          while (i < end) emit(false);
          emit(true);
          continue;
        }
      }
    }

    emit(true);
  }

  return { masked: out.join(""), unterminated };
}
