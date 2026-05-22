import { db } from "@/lib/db";
import { notFound } from "next/navigation";
import Link from "next/link";
import LeadDetailClient from "@/components/LeadDetailClient";
import type { Lead, Activity, Opportunity } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function LeadDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supa = db();

  const [leadRes, activitiesRes, oppsRes] = await Promise.all([
    supa.from("leads").select("*").eq("id", id).single(),
    supa.from("lead_activities").select("*").eq("lead_id", id).order("created_at", { ascending: false }),
    supa.from("opportunities").select("*").eq("lead_id", id).order("created_at", { ascending: false }),
  ]);

  if (leadRes.error || !leadRes.data) {
    notFound();
  }

  const lead = leadRes.data as Lead;
  const activities = (activitiesRes.data ?? []) as Activity[];
  const opportunities = (oppsRes.data ?? []) as Opportunity[];

  return (
    <div className="space-y-6">
      <Link href="/leads" className="text-sm text-brand-600 hover:underline">
        ← All leads
      </Link>
      <LeadDetailClient
        initialLead={lead}
        initialActivities={activities}
        initialOpportunities={opportunities}
      />
    </div>
  );
}
