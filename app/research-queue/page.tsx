import { db } from "@/lib/db";
import Link from "next/link";
import type { Lead, GenerationRun } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function ResearchQueuePage() {
  const sql = db();
  const [pendingRaw, inProgRaw, runsRaw] = await Promise.all([
    sql`
      SELECT * FROM leads
      WHERE research_status = 'pending'
      ORDER BY lead_score DESC
      LIMIT 50
    `,
    sql`
      SELECT * FROM leads
      WHERE research_status = 'in_progress'
      LIMIT 20
    `,
    sql`
      SELECT * FROM generation_runs
      ORDER BY started_at DESC
      LIMIT 20
    `,
  ]);
  const pending = pendingRaw as unknown as Lead[];
  const inProg = inProgRaw as unknown as Lead[];
  const runs = runsRaw as unknown as GenerationRun[];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Research Queue</h1>
        <p className="text-slate-500 mt-1">
          Leads being deeply researched by Gemini. Background worker runs every 30 minutes.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h2 className="font-semibold text-slate-900 mb-3">
            Pending ({pending.length})
          </h2>
          {pending.length === 0 ? (
            <div className="text-sm text-slate-500">Queue is empty.</div>
          ) : (
            <ul className="space-y-2 max-h-[500px] overflow-y-auto">
              {pending.map((l) => (
                <li key={l.id}>
                  <Link
                    href={`/leads/${l.id}`}
                    className="flex items-center gap-3 p-2 rounded-md hover:bg-slate-50"
                  >
                    <span className="text-xs font-semibold bg-slate-100 px-2 py-1 rounded">
                      {l.lead_score}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">
                        {l.company_name || l.person_name || "Unknown"}
                      </div>
                      <div className="text-xs text-slate-500 truncate">via {l.source}</div>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h2 className="font-semibold text-slate-900 mb-3">
            In progress ({inProg.length})
          </h2>
          {inProg.length === 0 ? (
            <div className="text-sm text-slate-500">Nothing running right now.</div>
          ) : (
            <ul className="space-y-2">
              {inProg.map((l) => (
                <li key={l.id} className="flex items-center gap-3 p-2 rounded-md">
                  <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                  <Link href={`/leads/${l.id}`} className="text-sm font-medium hover:text-brand-600">
                    {l.company_name || l.person_name || "Unknown"}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200">
        <h2 className="font-semibold text-slate-900 p-5 border-b border-slate-200">Recent runs</h2>
        <table className="w-full text-sm">
          <thead className="bg-slate-50">
            <tr className="text-left text-xs uppercase text-slate-500">
              <th className="px-4 py-2">Started</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2 text-right">Raw signals</th>
              <th className="px-4 py-2 text-right">New leads</th>
              <th className="px-4 py-2 text-right">Researched</th>
              <th className="px-4 py-2 text-right">Qualified</th>
              <th className="px-4 py-2">Notified</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {runs.map((r) => (
              <tr key={r.id}>
                <td className="px-4 py-2 text-slate-600">{new Date(r.started_at).toLocaleString()}</td>
                <td className="px-4 py-2">
                  <span className={`status-badge ${
                    r.status === "completed" ? "bg-emerald-50 text-emerald-700"
                    : r.status === "running" ? "bg-blue-50 text-blue-700"
                    : "bg-red-50 text-red-700"
                  }`}>
                    {r.status}
                  </span>
                </td>
                <td className="px-4 py-2 text-right">{r.raw_signals_found}</td>
                <td className="px-4 py-2 text-right">{r.leads_created}</td>
                <td className="px-4 py-2 text-right">{r.leads_researched}</td>
                <td className="px-4 py-2 text-right font-semibold text-emerald-700">{r.leads_qualified}</td>
                <td className="px-4 py-2">{r.notification_sent ? "✓" : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
