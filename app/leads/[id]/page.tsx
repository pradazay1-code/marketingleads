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
  const sql = db();

  const [leadRows, activities, opportunities] = await Promise.all([
    sql`SELECT * FROM leads WHERE id = ${id}`,
    sql`SELECT * FROM lead_activities WHERE lead_id = ${id} ORDER BY created_at DESC`,
    sql`SELECT * FROM opportunities WHERE lead_id = ${id} ORDER BY created_at DESC`,
  ]);

  const leads = leadRows as unknown as Lead[];
  if (leads.length === 0) notFound();

  return (
    <div className="space-y-6">
      <Link href="/leads" className="text-sm text-brand-600 hover:underline">
        ← All leads
      </Link>
      <LeadDetailClient
        initialLead={leads[0]}
        initialActivities={activities as unknown as Activity[]}
        initialOpportunities={opportunities as unknown as Opportunity[]}
      />
    </div>
  );
}
