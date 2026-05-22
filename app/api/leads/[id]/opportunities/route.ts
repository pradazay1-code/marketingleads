import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: leadId } = await params;
  const body = (await req.json()) as {
    name: string;
    service_type?: string;
    estimated_mrr?: number;
    estimated_one_time?: number;
    probability?: number;
    stage?: string;
    expected_close_date?: string;
    notes?: string;
  };

  const { data, error } = await db()
    .from("opportunities")
    .insert({
      lead_id: leadId,
      name: body.name,
      service_type: body.service_type ?? null,
      estimated_mrr: body.estimated_mrr ?? null,
      estimated_one_time: body.estimated_one_time ?? null,
      probability: body.probability ?? 25,
      stage: body.stage ?? "discovery",
      expected_close_date: body.expected_close_date ?? null,
      notes: body.notes ?? null,
    })
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Bump lead to opportunity stage
  await db().from("leads").update({ status: "opportunity" }).eq("id", leadId);
  await db().from("lead_activities").insert({
    lead_id: leadId,
    type: "opportunity_created",
    title: `Opportunity created: ${body.name}`,
    metadata: data,
    created_by: "user",
  });

  return NextResponse.json({ opportunity: data });
}
