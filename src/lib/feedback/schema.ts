import { z } from "zod";

/** Every feedback message is delivered to the founder's Gmail. */
export const FEEDBACK_EMAIL = "pydex2026@gmail.com";

export const FEEDBACK_CATEGORIES = ["general", "bug", "idea", "praise"] as const;
export type FeedbackCategory = (typeof FEEDBACK_CATEGORIES)[number];

export const CATEGORY_LABELS: Record<FeedbackCategory, string> = {
  general: "General",
  bug: "Bug report",
  idea: "Feature idea",
  praise: "Praise",
};

export const feedbackSchema = z.object({
  name: z.string().trim().min(1, "Please tell us your name").max(100, "Name must be under 100 characters"),
  email: z.string().trim().email("Please enter a valid email").max(255, "Email must be under 255 characters"),
  category: z.enum(FEEDBACK_CATEGORIES),
  message: z.string().trim().min(5, "Message is a bit short — add a few more words").max(2000, "Message must be under 2000 characters"),
});

export type FeedbackInput = z.infer<typeof feedbackSchema>;

const b64 = (s: string) => btoa(Array.from(new TextEncoder().encode(s), (b) => String.fromCharCode(b)).join(""));
const header = (v: string) => (/^[\x00-\x7F]*$/.test(v) ? v : `=?UTF-8?B?${b64(v)}?=`);
const oneLine = (v: string) => v.replace(/[\r\n]+/g, " ");

/** Builds the base64url RFC 2822 message Gmail expects. */
export function buildFeedbackRawEmail(input: FeedbackInput, id: string): string {
  const subject = `CodeShield feedback (${CATEGORY_LABELS[input.category]}) from ${oneLine(input.name)}`;
  const body = [
    `New feedback on CodeShield`,
    ``,
    `Name: ${oneLine(input.name)}`,
    `Email: ${oneLine(input.email)}`,
    `Type: ${CATEGORY_LABELS[input.category]}`,
    ``,
    input.message,
    ``,
    `— Reference: ${id}`,
  ].join("\r\n");
  const email = [
    `To: ${FEEDBACK_EMAIL}`,
    `Reply-To: ${oneLine(input.email)}`,
    `Subject: ${header(subject)}`,
    "MIME-Version: 1.0",
    'Content-Type: text/plain; charset="UTF-8"',
    "",
    body,
  ].join("\r\n");
  return b64(email).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
