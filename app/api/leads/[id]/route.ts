import { NextRequest, NextResponse } from "next/server";
import { db, updateRow, insertRow } from "@/lib/db";

export const dynamic = "force-dynamic";

const ALLOWED = [
  "status",
  "assigned_to",
  "company_name",
  "person_name",
  "email",
  "phone",
  "website",
  "linkedin_url",
];

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = (await req.json()) as Record<string, unknown>;
  const patch: Record<string, unknown> = {};
  for (const k of ALLOWED) if (k in body) patch[k] = body[k];
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "no allowed fields to update" }, { status: 400 });
  }

  const sql = db();
  const currentRows = (await sql`SELECT status FROM leads WHERE id = ${id}`) as Array<{ status: string }>;
  const current = currentRows[0];

  const updated = await updateRow("leads", id, patch);
  if (!updated) return NextResponse.json({ error: "lead not found" }, { status: 404 });

  if ("status" in patch && current && current.status !== patch.status) {
    await insertRow("lead_activities", {
      lead_id: id,
      type: "status_change",
      title: `Status: ${current.status} → ${patch.status}`,
      metadata: { from: current.status, to: patch.status },
      created_by: "user",
    });
  }

  return NextResponse.json({ lead: updated });
}
