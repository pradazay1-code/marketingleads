import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { researchLead } from "@/lib/research/claudeResearch";
import { isEastCoast } from "@/lib/keywords";
import type { Lead } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { data: lead, error } = await db().from("leads").select("*").eq("id", id).single();
  if (error || !lead) return NextResponse.json({ error: "lead not found" }, { status: 404 });

  await db().from("leads").update({ research_status: "in_progress" }).eq("id", id);

  try {
    const r = await researchLead(lead as Lead);
    const updated = {
      company_name: r.company_name ?? lead.company_name,
      person_name: r.person_name ?? lead.person_name,
      website: r.website ?? lead.website,
      industry: r.industry ?? lead.industry,
      company_size: r.company_size ?? lead.company_size,
      location: r.location ?? lead.location,
      state: r.state ?? lead.state,
      is_east_coast: isEastCoast(r.state ?? lead.state),
      research_status: "completed",
      research_summary: r.summary,
      research_data: r,
      pain_points: r.pain_points,
      buying_signals: r.buying_signals,
      recommended_services: r.recommended_services,
      outreach_angle: r.outreach_angle,
      lead_score: r.lead_score,
      score_breakdown: r.score_breakdown,
      last_researched_at: new Date().toISOString(),
    };
    const { data: leadOut } = await db()
      .from("leads")
      .update(updated)
      .eq("id", id)
      .select("*")
      .single();
    const { data: activity } = await db()
      .from("lead_activities")
      .insert({
        lead_id: id,
        type: "research_update",
        title: "Manual re-research completed",
        content: r.summary,
        metadata: r,
        created_by: "user",
      })
      .select("*")
      .single();

    return NextResponse.json({ lead: leadOut, activity });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await db()
      .from("leads")
      .update({ research_status: "failed", research_summary: `Error: ${msg}` })
      .eq("id", id);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
