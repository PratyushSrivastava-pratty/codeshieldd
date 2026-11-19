export type Language = "python" | "javascript" | "html" | "css" | "cpp";
export type Category = "syntax" | "bug" | "security" | "quality";
export type Severity = "high" | "medium" | "low";

/** Line-based edit. Lines are 1-based. `insert` puts a new line BEFORE `line`. */
export type Patch =
  | { op: "replace"; line: number; text: string }
  | { op: "insert"; line: number; text: string }
  | { op: "delete"; line: number };

export interface Issue {
  id: string;
  rule: string;
  line: number;
  /** 0-based column */
  column: number;
  category: Category;
  severity: Severity;
  title: string;
  message: string;
  suggestion: string;
  patches?: Patch[];
}

export interface ScanResult {
  language: Language;
  issues: Issue[];
  score: number;
  lineCount: number;
}

export const LANGUAGES: { id: Language; label: string; short: string }[] = [
  { id: "python", label: "Python", short: "PY" },
  { id: "javascript", label: "JavaScript", short: "JS" },
  { id: "html", label: "HTML", short: "HTML" },
  { id: "css", label: "CSS", short: "CSS" },
  { id: "cpp", label: "C++", short: "C++" },
];
