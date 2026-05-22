import { db } from "@/lib/db";
import Link from "next/link";
import type { Lead } from "@/lib/types";
import LeadsFilter from "@/components/LeadsFilter";

export const dynamic = "force-dynamic";

function scoreColor(score: number) {
  if (score >= 80) return "bg-emerald-500";
  if (score >= 65) return "bg-brand-500";
  if (score >= 45) return "bg-amber-500";
  return "bg-slate-400";
}

function timeAgo(iso: string | null): string {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

interface SearchParams {
  status?: string;
  source?: string;
  east?: string;
  q?: string;
  min_score?: string;
}

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  let query = db().from("leads").select("*").order("lead_score", { ascending: false }).order("created_at", { ascending: false }).limit(200);
  if (params.status) query = query.eq("status", params.status);
  if (params.source) query = query.eq("source", params.source);
  if (params.east === "1") query = query.eq("is_east_coast", true);
  if (params.min_score) query = query.gte("lead_score", parseInt(params.min_score, 10));
  if (params.q) {
    query = query.or(
      `company_name.ilike.%${params.q}%,person_name.ilike.%${params.q}%,intent_signal.ilike.%${params.q}%`
    );
  }

  const { data: leads, error } = await query;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Leads</h1>
        <p className="text-slate-500 mt-1">
          Every prospect discovered by the system, ranked by score.
        </p>
      </div>

      <LeadsFilter />

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">
          Error loading leads: {error.message}
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr className="text-left text-xs font-medium text-slate-500 uppercase tracking-wide">
              <th className="px-4 py-3 w-16">Score</th>
              <th className="px-4 py-3">Lead</th>
              <th className="px-4 py-3">Intent signal</th>
              <th className="px-4 py-3">Source</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Found</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {(leads ?? []).length === 0 ? (
              <tr>
                <td colSpan={6} className="p-10 text-center text-sm text-slate-500">
                  No leads match these filters yet.
                </td>
              </tr>
            ) : (
              (leads as Lead[]).map((l) => (
                <tr key={l.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <div className={`score-pill ${scoreColor(l.lead_score)}`}>
                      {l.lead_score}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <Link href={`/leads/${l.id}`} className="block">
                      <div className="font-medium text-slate-900 hover:text-brand-600">
                        {l.company_name || l.person_name || "Unknown"}
                      </div>
                      <div className="text-xs text-slate-500 flex items-center gap-2 mt-0.5">
                        {l.location && <span>{l.location}</span>}
                        {l.is_east_coast && (
                          <span className="status-badge bg-blue-50 text-blue-700">
                            East Coast
                          </span>
                        )}
                      </div>
                    </Link>
                  </td>
                  <td className="px-4 py-3 max-w-md">
                    <div className="text-sm text-slate-700 truncate">
                      {l.intent_signal ?? "—"}
                    </div>
                    {l.matched_keywords && l.matched_keywords.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {l.matched_keywords.slice(0, 3).map((k) => (
                          <span key={k} className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
                            {k}
                          </span>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className="status-badge bg-slate-100 text-slate-700">
                      {l.source}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`status-badge ${statusColor(l.status)}`}
                    >
                      {l.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500">
                    {timeAgo(l.created_at)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function statusColor(s: string): string {
  switch (s) {
    case "new":
      return "bg-blue-50 text-blue-700";
    case "contacted":
      return "bg-amber-50 text-amber-700";
    case "qualified":
      return "bg-emerald-50 text-emerald-700";
    case "opportunity":
      return "bg-violet-50 text-violet-700";
    case "won":
      return "bg-green-100 text-green-800";
    case "lost":
      return "bg-slate-200 text-slate-700";
    default:
      return "bg-slate-100 text-slate-600";
  }
}
