import { Resend } from "resend";

let client: Resend | null = null;
function getClient() {
  if (client) return client;
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  client = new Resend(key);
  return client;
}

export async function sendEmail(opts: {
  to: string;
  subject: string;
  html: string;
}): Promise<{ ok: boolean; id?: string; error?: string }> {
  const c = getClient();
  const from = process.env.NOTIFY_FROM_EMAIL || "leads@aventis.local";
  if (!c) {
    console.warn("[resend] not configured — would have sent:", opts.subject);
    return { ok: false, error: "Resend not configured" };
  }
  try {
    const result = await c.emails.send({
      from,
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
    });
    if (result.error) {
      return { ok: false, error: result.error.message };
    }
    return { ok: true, id: result.data?.id };
  } catch (err) {
    const m = err instanceof Error ? err.message : String(err);
    console.error("[resend] send failed:", m);
    return { ok: false, error: m };
  }
}
