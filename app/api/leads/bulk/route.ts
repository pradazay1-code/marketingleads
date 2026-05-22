import { NextRequest, NextResponse } from "next/server";
import { db, updateRowsByIds, insertRow } from "@/lib/db";

export const dynamic = "force-dynamic";

const ALLOWED_STATUSES = new Set([
  "new",
  "contacted",
  "qualified",
  "opportunity",
  "won",
  "lost",
  "archived",
]);

interface Body {
  ids: string[];
  action: "set_status" | "delete" | "mark_notified";
  value?: string;
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as Body;
  if (!body?.ids || !Array.isArray(body.ids) || body.ids.length === 0) {
    return NextResponse.json({ error: "no ids" }, { status: 400 });
  }
  if (body.ids.length > 500) {
    return NextResponse.json({ error: "too many ids (max 500)" }, { status: 400 });
  }

  const sql = db();

  try {
    if (body.action === "set_status") {
      if (!body.value || !ALLOWED_STATUSES.has(body.value)) {
        return NextResponse.json({ error: "invalid status" }, { status: 400 });
      }
      await updateRowsByIds("leads", body.ids, { status: body.value });

      // Log activity rows for each (parallel insert via sql.query for efficiency)
      await Promise.all(
        body.ids.map((id) =>
          insertRow("lead_activities", {
            lead_id: id,
            type: "status_change",
            title: `Bulk status update → ${body.value}`,
            created_by: "user",
          }).catch(() => null)
        )
      );
      await insertRow("audit_log", {
        action: "bulk_status",
        resource_type: "leads",
        metadata: { count: body.ids.length, new_status: body.value },
      });
      return NextResponse.json({ ok: true, updated: body.ids.length });
    }

    if (body.action === "delete") {
      // Soft delete: archive instead of hard delete
      await updateRowsByIds("leads", body.ids, { status: "archived" });
      await insertRow("audit_log", {
        action: "bulk_archive",
        resource_type: "leads",
        metadata: { count: body.ids.length },
      });
      return NextResponse.json({ ok: true, archived: body.ids.length });
    }

    if (body.action === "mark_notified") {
      const placeholders = body.ids.map((_, i) => `$${i + 1}`).join(", ");
      await sql(
        `UPDATE leads SET notified = true, notified_at = now() WHERE id IN (${placeholders})`,
        body.ids
      );
      return NextResponse.json({ ok: true, marked: body.ids.length });
    }

    return NextResponse.json({ error: "unknown action" }, { status: 400 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
