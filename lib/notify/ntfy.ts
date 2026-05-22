/**
 * ntfy.sh — free push notifications to your phone.
 *
 * SETUP (60 seconds, NO account, NO cost):
 * 1. Install the "ntfy" app on your phone (Android: Play Store / iPhone: App Store)
 * 2. Pick a long random topic name, e.g. "aventis-leads-isaiah-x9k2p4q"
 *    (it's effectively your password — anyone who knows it can send you notifications,
 *     so make it long and unguessable)
 * 3. In the app, tap "+" and subscribe to that exact topic
 * 4. Set NTFY_TOPIC in your env vars to that same string
 * 5. Done. Every batch will appear as a push notification on your phone.
 *
 * For ad-free / encrypted / private hosting, you can self-host ntfy
 * (set NTFY_SERVER to your URL) — but the public ntfy.sh works fine.
 */

export interface NtfyOpts {
  title: string;
  message: string;
  priority?: 1 | 2 | 3 | 4 | 5; // 5 = max (bypass DND on Android)
  tags?: string[];
  click?: string;
  actions?: Array<{
    action: "view";
    label: string;
    url: string;
  }>;
}

export async function sendNtfy(opts: NtfyOpts): Promise<{ ok: boolean; error?: string }> {
  const topic = process.env.NTFY_TOPIC;
  if (!topic) {
    console.warn("[ntfy] NTFY_TOPIC not set — would have sent:", opts.title);
    return { ok: false, error: "NTFY_TOPIC not set" };
  }
  const server = (process.env.NTFY_SERVER || "https://ntfy.sh").replace(/\/$/, "");

  try {
    const headers: Record<string, string> = {
      "Content-Type": "text/plain; charset=utf-8",
      Title: opts.title,
    };
    if (opts.priority) headers.Priority = String(opts.priority);
    if (opts.tags?.length) headers.Tags = opts.tags.join(",");
    if (opts.click) headers.Click = opts.click;
    if (opts.actions?.length) {
      // Action format: "view, label, url, clear=true"
      headers.Actions = opts.actions
        .map((a) => `${a.action}, ${a.label}, ${a.url}, clear=true`)
        .join("; ");
    }

    // Optional auth (if user self-hosts ntfy with access tokens)
    const token = process.env.NTFY_TOKEN;
    if (token) headers.Authorization = `Bearer ${token}`;

    const res = await fetch(`${server}/${encodeURIComponent(topic)}`, {
      method: "POST",
      headers,
      body: opts.message,
    });
    if (!res.ok) {
      const errText = await res.text();
      return { ok: false, error: `ntfy ${res.status}: ${errText.slice(0, 200)}` };
    }
    return { ok: true };
  } catch (err) {
    const m = err instanceof Error ? err.message : String(err);
    console.error("[ntfy] send failed:", m);
    return { ok: false, error: m };
  }
}
