import { db } from "@/lib/db";
import type { Lead } from "@/lib/types";
import LeadsFilter from "@/components/LeadsFilter";
import LeadsTable from "@/components/LeadsTable";

export const dynamic = "force-dynamic";

interface SearchParams {
  status?: string;
  source?: string;
  east?: string;
  q?: string;
  min_score?: string;
  contactable?: string;
}

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const sql = db();

  // Build the WHERE clause dynamically
  const conditions: string[] = [];
  const sqlParams: unknown[] = [];
  const push = (clause: string, value: unknown) => {
    sqlParams.push(value);
    conditions.push(clause.replace("?", `$${sqlParams.length}`));
  };
  if (params.status) push("status = ?", params.status);
  if (params.source) push("source = ?", params.source);
  if (params.east === "1") conditions.push("is_east_coast = true");
  if (params.min_score) push("lead_score >= ?", parseInt(params.min_score, 10));
  // Contactable filter is ON by default — flip to "0" to see everything
  if (params.contactable !== "0") conditions.push("contactability_score >= 45");
  if (params.q) {
    const q = `%${params.q}%`;
    sqlParams.push(q, q, q);
    const n = sqlParams.length;
    conditions.push(
      `(company_name ILIKE $${n - 2} OR person_name ILIKE $${n - 1} OR intent_signal ILIKE $${n})`
    );
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const leads = (await sql(
    `SELECT * FROM leads ${where} ORDER BY lead_score DESC, created_at DESC LIMIT 200`,
    sqlParams
  )) as unknown as Lead[];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Leads</h1>
        <p className="text-slate-500 mt-1">Every prospect discovered by the system, ranked by score.</p>
      </div>

      <LeadsFilter />
      <LeadsTable leads={leads} />
    </div>
  );
}
