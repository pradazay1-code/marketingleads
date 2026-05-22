import { db } from "../db";
import { sendSms } from "./twilio";
import { sendEmail } from "./resend";
import type { Lead } from "../types";

/**
 * Send the 4-hour batch notification.
 * - SMS: short summary with top 3 leads + dashboard link
 * - Email: full HTML report of every qualified lead in the batch
 */
export async function notifyBatch(opts: {
  leads: Lead[];
  batchId: string;
  runId: string;
}): Promise<{ smsOk: boolean; emailOk: boolean }> {
  const { leads, batchId, runId } = opts;
  if (leads.length === 0) {
    console.log("[notify] no leads to notify");
    return { smsOk: false, emailOk: false };
  }

  const dashboard = (process.env.NEXT_PUBLIC_SITE_URL || "").replace(/\/$/, "");
  const top = [...leads].sort((a, b) => b.lead_score - a.lead_score).slice(0, 3);
  const smsBody = buildSmsBody(top, leads.length, dashboard, batchId);
  const emailHtml = buildEmailHtml(leads, dashboard, batchId, runId);

  let smsOk = false;
  const phoneTo = process.env.NOTIFY_TO_PHONE;
  if (phoneTo) {
    const smsRes = await sendSms(phoneTo, smsBody);
    smsOk = smsRes.ok;
    await db().from("notifications").insert({
      channel: "sms",
      recipient: phoneTo,
      body: smsBody,
      status: smsRes.ok ? "sent" : "failed",
      provider_id: smsRes.sid ?? null,
      provider_response: smsRes,
      lead_ids: leads.map((l) => l.id),
      batch_id: batchId,
      sent_at: smsRes.ok ? new Date().toISOString() : null,
    });
  }

  let emailOk = false;
  const emailTo = process.env.NOTIFY_TO_EMAIL;
  if (emailTo) {
    const emRes = await sendEmail({
      to: emailTo,
      subject: `[Aventis Leads] ${leads.length} new qualified lead${leads.length === 1 ? "" : "s"} — top score ${top[0].lead_score}/100`,
      html: emailHtml,
    });
    emailOk = emRes.ok;
    await db().from("notifications").insert({
      channel: "email",
      recipient: emailTo,
      subject: `[Aventis Leads] ${leads.length} new qualified leads`,
      body: emailHtml,
      status: emRes.ok ? "sent" : "failed",
      provider_id: emRes.id ?? null,
      provider_response: emRes,
      lead_ids: leads.map((l) => l.id),
      batch_id: batchId,
      sent_at: emRes.ok ? new Date().toISOString() : null,
    });
  }

  // Mark leads as notified
  if (smsOk || emailOk) {
    await db()
      .from("leads")
      .update({
        notified: true,
        notified_at: new Date().toISOString(),
        notification_batch_id: batchId,
      })
      .in("id", leads.map((l) => l.id));
  }

  return { smsOk, emailOk };
}

function buildSmsBody(top: Lead[], total: number, dashboard: string, batchId: string): string {
  const lines = [`🎯 ${total} new lead${total === 1 ? "" : "s"} (Aventis)`];
  for (const l of top) {
    const who = l.company_name || l.person_name || "(unknown)";
    const tag = l.is_east_coast ? "🌊EC" : "";
    lines.push(`• ${l.lead_score}/100 ${tag} ${who}`);
  }
  if (dashboard) lines.push(`👉 ${dashboard}/?batch=${batchId.slice(0, 8)}`);
  return lines.join("\n");
}

function buildEmailHtml(leads: Lead[], dashboard: string, batchId: string, runId: string): string {
  const rows = leads
    .sort((a, b) => b.lead_score - a.lead_score)
    .map((l) => {
      const who = escapeHtml(l.company_name || l.person_name || "(unknown)");
      const services = (l.recommended_services ?? []).map(escapeHtml).join(", ");
      const angle = escapeHtml(l.outreach_angle ?? "");
      const signal = escapeHtml((l.intent_signal ?? "").slice(0, 200));
      const eastCoast = l.is_east_coast
        ? `<span style="background:#dbeafe;color:#1e3a8a;padding:2px 6px;border-radius:4px;font-size:11px;">EAST COAST</span>`
        : "";
      const detailLink = dashboard ? `${dashboard}/leads/${l.id}` : "#";
      return `
        <tr style="border-bottom:1px solid #e5e7eb;">
          <td style="padding:14px;vertical-align:top;width:60px;">
            <div style="background:#5168fa;color:white;font-weight:700;border-radius:6px;text-align:center;padding:8px;font-size:18px;">${l.lead_score}</div>
          </td>
          <td style="padding:14px;vertical-align:top;">
            <div style="font-size:16px;font-weight:600;color:#111827;">${who} ${eastCoast}</div>
            <div style="color:#6b7280;font-size:13px;margin-top:2px;">via ${escapeHtml(l.source)} · ${escapeHtml(l.location ?? "")}</div>
            <div style="margin-top:8px;color:#374151;font-size:13px;font-style:italic;">"${signal}"</div>
            <div style="margin-top:8px;color:#111827;font-size:13px;"><strong>Fit:</strong> ${services || "—"}</div>
            ${angle ? `<div style="margin-top:6px;color:#111827;font-size:13px;"><strong>Open with:</strong> ${angle}</div>` : ""}
            <div style="margin-top:10px;">
              <a href="${detailLink}" style="background:#5168fa;color:white;padding:6px 12px;border-radius:6px;text-decoration:none;font-size:12px;">Open in CRM →</a>
              ${l.source_url ? `<a href="${escapeHtml(l.source_url)}" style="margin-left:8px;color:#5168fa;font-size:12px;">Original post</a>` : ""}
            </div>
          </td>
        </tr>`;
    })
    .join("");

  return `<!doctype html><html><body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f9fafb;">
    <div style="max-width:680px;margin:0 auto;padding:24px;">
      <div style="background:white;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.06);">
        <div style="background:linear-gradient(135deg,#5168fa,#252b85);padding:24px;color:white;">
          <div style="font-size:13px;opacity:0.9;letter-spacing:0.5px;text-transform:uppercase;">Aventis Leads · 4-hour batch</div>
          <div style="font-size:24px;font-weight:700;margin-top:4px;">${leads.length} qualified lead${leads.length === 1 ? "" : "s"}</div>
          <div style="font-size:13px;opacity:0.85;margin-top:4px;">Batch ${batchId.slice(0, 8)} · Run ${runId.slice(0, 8)}</div>
        </div>
        <table style="width:100%;border-collapse:collapse;">${rows}</table>
        <div style="padding:18px;text-align:center;background:#f9fafb;border-top:1px solid #e5e7eb;">
          <a href="${dashboard}" style="color:#5168fa;text-decoration:none;font-weight:600;">Open Aventis Leads CRM →</a>
        </div>
      </div>
      <div style="text-align:center;color:#9ca3af;font-size:11px;margin-top:16px;">
        Aventis Leads · autonomous lead discovery for Aventis Marketing & AventisAI
      </div>
    </div>
  </body></html>`;
}

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
