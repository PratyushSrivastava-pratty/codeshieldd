import { describe, expect, it } from "vitest";
import { buildFeedbackRawEmail, FEEDBACK_EMAIL, feedbackSchema } from "./schema";

const decode = (raw: string) =>
  new TextDecoder().decode(Uint8Array.from(atob(raw.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0)));

const valid = { name: "Asha", email: "asha@example.com", category: "bug" as const, message: "The scanner missed a colon." };

describe("feedback", () => {
  it("is addressed to the founder's Gmail", () => {
    expect(FEEDBACK_EMAIL).toBe("pydex2026@gmail.com");
    expect(decode(buildFeedbackRawEmail(valid, "abc"))).toContain("To: pydex2026@gmail.com");
  });

  it("lets the founder reply straight to the sender", () => {
    expect(decode(buildFeedbackRawEmail(valid, "abc"))).toContain("Reply-To: asha@example.com");
  });

  it("rejects an invalid email and an over-long message", () => {
    expect(feedbackSchema.safeParse({ ...valid, email: "nope" }).success).toBe(false);
    expect(feedbackSchema.safeParse({ ...valid, message: "x".repeat(2001) }).success).toBe(false);
    expect(feedbackSchema.safeParse(valid).success).toBe(true);
  });

  it("cannot inject extra mail headers through the name", () => {
    const raw = decode(buildFeedbackRawEmail({ ...valid, name: "Eve\r\nBcc: x@y.z" }, "abc"));
    expect(raw).not.toMatch(/^Bcc:/m);
  });
});
