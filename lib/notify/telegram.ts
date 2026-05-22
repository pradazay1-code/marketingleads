/**
 * Telegram bot — free push notifications with rich formatting + buttons.
 *
 * SETUP (5 min, NO cost):
 * 1. Install Telegram on your phone
 * 2. Open Telegram, search for @BotFather → /newbot → follow prompts → save the TOKEN
 * 3. Search for @userinfobot → /start → it tells you your numeric CHAT_ID
 * 4. Start a chat with your new bot (so it can message you) → send any message to it
 * 5. Set TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID env vars
 *
 * vs ntfy.sh: ntfy is simpler (no account), Telegram is richer (buttons, markdown).
 * Use whichever you prefer — or both.
 */

export interface TelegramOpts {
  text: string;
  parseMode?: "MarkdownV2" | "HTML";
  buttons?: Array<{ text: string; url: string }>;
  disablePreview?: boolean;
}

export async function sendTelegram(opts: TelegramOpts): Promise<{ ok: boolean; error?: string }> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) {
    console.warn("[telegram] not configured — would have sent");
    return { ok: false, error: "Telegram not configured" };
  }

  try {
    const body: Record<string, unknown> = {
      chat_id: chatId,
      text: opts.text,
      parse_mode: opts.parseMode ?? "HTML",
      disable_web_page_preview: opts.disablePreview ?? true,
    };

    if (opts.buttons?.length) {
      body.reply_markup = {
        inline_keyboard: [opts.buttons.map((b) => ({ text: b.text, url: b.url }))],
      };
    }

    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const errText = await res.text();
      return { ok: false, error: `telegram ${res.status}: ${errText.slice(0, 200)}` };
    }
    return { ok: true };
  } catch (err) {
    const m = err instanceof Error ? err.message : String(err);
    console.error("[telegram] send failed:", m);
    return { ok: false, error: m };
  }
}
