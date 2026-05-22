import { db } from "@/lib/db";
import Link from "next/link";
import type { Lead, Opportunity } from "@/lib/types";

export const dynamic = "force-dynamic";

const STAGES = [
  { key: "new", label: "New" },
  { key: "contacted", label: "Contacted" },
  { key: "qualified", label: "Qualified" },
  { key: "opportunity", label: "Opportunity" },
  { key: "won", label: "Won" },
];

interface LeadWithOpps extends Lead {
  opportunities: Opportunity[];
}

export default async function PipelinePage() {
  const sql = db();

  // Use json aggregation to fetch leads + their opportunities in one query
  const stageKeys = STAGES.map((s) => s.key);
  const leads = (await sql`
    SELECT l.*,
           COALESCE(
             (SELECT json_agg(o.*) FROM opportunities o WHERE o.lead_id = l.id),
             '[]'::json
           ) AS opportunities
    FROM leads l
    WHERE l.status = ANY(${stageKeys})
    ORDER BY l.lead_score DESC
    LIMIT 300
  `) as unknown as LeadWithOpps[];

  const grouped: Record<string, LeadWithOpps[]> = Object.fromEntries(
    STAGES.map((s) => [s.key, []])
  );
  for (const l of leads) {
    if (l.status in grouped) grouped[l.status].push(l);
  }

  const totalMrr = leads
    .flatMap((l) => l.opportunities ?? [])
    .reduce((acc, o) => acc + Number(o.estimated_mrr ?? 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Pipeline</h1>
          <p className="text-slate-500 mt-1">Kanban view of all active leads</p>
        </div>
        <div className="text-right">
          <div className="text-xs text-slate-500 uppercase">Pipeline MRR</div>
          <div className="text-2xl font-bold text-emerald-600">
            ${totalMrr.toLocaleString()}/mo
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {STAGES.map((stage) => {
          const items = grouped[stage.key];
          return (
            <div key={stage.key} className="bg-slate-50 rounded-xl p-3">
              <div className="flex items-center justify-between mb-2 px-1">
                <h3 className="font-medium text-slate-700 text-sm">{stage.label}</h3>
                <span className="text-xs text-slate-500 bg-white px-2 py-0.5 rounded-full">
                  {items.length}
                </span>
              </div>
              <div className="space-y-2 max-h-[70vh] overflow-y-auto">
                {items.map((l) => (
                  <Link
                    key={l.id}
                    href={`/leads/${l.id}`}
                    className="block bg-white rounded-md p-3 border border-slate-200 hover:border-brand-400 hover:shadow-sm transition"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="font-medium text-slate-900 text-sm leading-tight truncate">
                        {l.company_name || l.person_name || "Unknown"}
                      </div>
                      <span
                        className={`shrink-0 text-xs font-semibold px-1.5 py-0.5 rounded ${
                          l.lead_score >= 80
                            ? "bg-emerald-100 text-emerald-700"
                            : l.lead_score >= 65
                            ? "bg-brand-100 text-brand-700"
                            : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {l.lead_score}
                      </span>
                    </div>
                    {l.is_east_coast && (
                      <div className="text-[10px] text-blue-700 mt-1">East Coast</div>
                    )}
                    <div className="text-xs text-slate-500 mt-1.5 line-clamp-2">
                      {l.intent_signal ?? ""}
                    </div>
                    {(l.opportunities ?? []).length > 0 && (
                      <div className="text-xs text-emerald-700 mt-1 font-medium">
                        $
                        {(l.opportunities ?? [])
                          .reduce((a, o) => a + Number(o.estimated_mrr ?? 0), 0)
                          .toLocaleString()}
                        /mo
                      </div>
                    )}
                  </Link>
                ))}
                {items.length === 0 && (
                  <div className="text-xs text-slate-400 text-center py-6">empty</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
