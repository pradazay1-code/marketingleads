import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();
  const allowed = ["status", "assigned_to", "company_name", "person_name", "email", "phone", "website", "linkedin_url"];
  const patch: Record<string, unknown> = {};
  for (const k of allowed) if (k in body) patch[k] = body[k];

  // Fetch current to log status change activity
  const { data: current } = await db().from("leads").select("status").eq("id", id).single();
  const { data, error } = await db().from("leads").update(patch).eq("id", id).select("*").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if ("status" in patch && current && current.status !== patch.status) {
    await db().from("lead_activities").insert({
      lead_id: id,
      type: "status_change",
      title: `Status: ${current.status} → ${patch.status}`,
      metadata: { from: current.status, to: patch.status },
      created_by: "user",
    });
  }

  return NextResponse.json({ lead: data });
}
