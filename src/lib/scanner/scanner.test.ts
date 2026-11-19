import { describe, expect, it } from "vitest";
import { autoResolveAll, fixIssue, scanCode } from "./index";
import { SAMPLES } from "./samples";
import type { Language } from "./types";

const LANGS: Language[] = ["python", "javascript", "html", "css", "cpp"];

describe("clean code gets the all-clear", () => {
  for (const lang of LANGS) {
    it(`${lang}: clean sample has zero issues and a perfect score`, () => {
      const r = scanCode(SAMPLES[lang].clean, lang);
      expect(r.issues).toEqual([]);
      expect(r.score).toBe(100);
    });
  }
});

describe("buggy code is flagged and fully auto-resolved", () => {
  const expected: Record<Language, string[]> = {
    python: ["hardcoded-secret", "missing-colon", "dangerous-eval", "assign-in-condition", "print-statement", "typo", "unclosed-bracket"],
    javascript: ["hardcoded-secret", "missing-semicolon", "xss-innerhtml", "dangerous-eval", "typo", "unclosed-bracket"],
    html: ["unknown-tag", "unclosed-tag", "target-blank", "xss-innerhtml"],
    css: ["unknown-property", "invalid-color", "missing-semicolon", "missing-colon", "missing-open-brace", "css-injection"],
    cpp: ["missing-semicolon", "missing-semicolon-type", "gets", "unsafe-c-string", "off-by-one", "delete-array"],
  };
  for (const lang of LANGS) {
    it(`${lang}: flags the planted bugs`, () => {
      const rules = scanCode(SAMPLES[lang].buggy, lang).issues.map((i) => i.rule);
      for (const r of expected[lang]) expect(rules).toContain(r);
    });
    it(`${lang}: Auto-Resolve All leaves zero issues`, () => {
      const out = autoResolveAll(SAMPLES[lang].buggy, lang);
      expect(out.result.issues).toEqual([]);
      expect(scanCode(out.code, lang).issues).toEqual([]);
    });
  }
});

describe("specific rules", () => {
  it("flags a hardcoded KEY= as high-risk security and points to the right line", () => {
    const r = scanCode('x = 1\nKEY = "abc123secret"\n', "python");
    const issue = r.issues.find((i) => i.rule === "hardcoded-secret");
    expect(issue?.line).toBe(2);
    expect(issue?.severity).toBe("high");
    expect(issue?.category).toBe("security");
  });

  it("fixing a single JS missing semicolon patches only that line", () => {
    const code = "let a = 1\nlet b = 2;";
    const issue = scanCode(code, "javascript").issues.find((i) => i.rule === "missing-semicolon");
    expect(issue?.line).toBe(1);
    expect(fixIssue(code, issue!)).toBe("let a = 1;\nlet b = 2;");
  });

  it("ignores eval written inside strings and comments", () => {
    const r = scanCode('# eval(x) is bad\nprint("never eval(input())")\n', "python");
    expect(r.issues).toEqual([]);
  });

  it("detects unclosed C++ braces", () => {
    const r = scanCode("int main() {\n    return 0;\n", "cpp");
    expect(r.issues.some((i) => i.rule === "unclosed-bracket")).toBe(true);
  });

  it("empty input produces no issues", () => {
    expect(scanCode("", "javascript").issues).toEqual([]);
  });
});
