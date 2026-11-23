import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { buildFeedbackRawEmail, feedbackSchema } from "./schema";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/google_mail/gmail/v1";

export const submitFeedback = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => feedbackSchema.parse(input))
  .handler(async ({ data }) => {
    const url = process.env["SUPABASE_URL"];
    const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
    if (!url || !key) throw new Error("Feedback storage is not configured");

    const supabase = createClient<Database>(url, key, {
      auth: { persistSession: false },
      global: {
        fetch: (input, init) => {
          const h = new Headers(init?.headers);
          if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) h.delete("Authorization");
          h.set("apikey", key);
          return fetch(input, { ...init, headers: h });
        },
      },
    });

    const id = crypto.randomUUID();
    const { error } = await supabase.from("feedback_submissions").insert({ id, ...data });
    if (error) {
      console.error("Feedback insert failed:", error.message);
      throw new Error("Could not save your feedback. Please try again.");
    }

    // Forward to the founder's Gmail when the Gmail connection is linked.
    let emailed = false;
    const lovableKey = process.env["LOVABLE_API_KEY"];
    const gmailKey = process.env["GOOGLE_MAIL_API_KEY"];
    if (lovableKey && gmailKey) {
      const res = await fetch(`${GATEWAY_URL}/users/me/messages/send`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${lovableKey}`,
          "X-Connection-Api-Key": gmailKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ raw: buildFeedbackRawEmail(data, id) }),
      });
      if (res.ok) emailed = true;
      else console.error(`Gmail send failed [${res.status}]: ${await res.text()}`);
    }

    return { id, emailed };
  });
