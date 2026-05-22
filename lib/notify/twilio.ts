import twilio from "twilio";

let client: ReturnType<typeof twilio> | null = null;
function getClient() {
  if (client) return client;
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const auth = process.env.TWILIO_AUTH_TOKEN;
  if (!sid || !auth) return null;
  client = twilio(sid, auth);
  return client;
}

export async function sendSms(to: string, body: string): Promise<{ ok: boolean; sid?: string; error?: string }> {
  const c = getClient();
  const from = process.env.TWILIO_FROM_PHONE;
  if (!c || !from) {
    console.warn("[twilio] not configured — would have sent:", body);
    return { ok: false, error: "Twilio not configured" };
  }
  try {
    const msg = await c.messages.create({ to, from, body: body.slice(0, 1500) });
    return { ok: true, sid: msg.sid };
  } catch (err) {
    const m = err instanceof Error ? err.message : String(err);
    console.error("[twilio] send failed:", m);
    return { ok: false, error: m };
  }
}
