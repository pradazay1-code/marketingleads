import { db, countRows } from "@/lib/db";
import Link from "next/link";
import { TrendingUp, Users, Target, Sparkles, Clock, MapPin } from "lucide-react";
import type { Lead, GenerationRun } from "@/lib/types";
import SetupNeeded, { type SetupState } from "@/components/SetupNeeded";
import SystemStatus from "@/components/SystemStatus";

export const revalidate = 30;
export const dynamic = "force-dynamic";

function envState(): SetupState {
  return {
    databaseUrl: !!process.env.DATABASE_URL,
    schemaApplied: false, // determined at runtime
    aiKey: !!(process.env.GEMINI_API_KEY || process.env.GROQ_API_KEY),
    ntfy: !!process.env.NTFY_TOPIC,
    email: !!(process.env.RESEND_API_KEY && process.env.NOTIFY_TO_EMAIL),
    cronSecret: !!process.env.CRON_SECRET,
    siteUrl: !!process.env.NEXT_PUBLIC_SITE_URL,
  };
}

async function getStats() {
  const sql = db();
  const since24 = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const [all, last24, qualified, eastCoast, openOpps, topLeads, latestRuns, sourcesRows] =
    await Promise.all([
      countRows("leads"),
      countRows("leads", "WHERE created_at >= $1", [since24]),
      countRows("leads", "WHERE lead_score >= 65 AND created_at >= $1", [since7d]),
      countRows("leads", "WHERE is_east_coast = true AND created_at >= $1", [since7d]),
      countRows("opportunities", "WHERE stage NOT IN ('closed_won','closed_lost')"),
      sql`
        SELECT * FROM leads
        ORDER BY lead_score DESC, created_at DESC
        LIMIT 6
      `,
      sql`
        SELECT * FROM generation_runs
        ORDER BY started_at DESC
        LIMIT 5
      `,
      sql`
        SELECT name, type, enabled, last_run_at, last_success_at, last_error
        FROM sources ORDER BY name
      `,
    ]);

  return {
    totals: { all, last24, qualified7d: qualified, eastCoast7d: eastCoast, openOpps },
    topLeads: topLeads as unknown as Lead[],
    latestRun: ((latestRuns as unknown as GenerationRun[])[0]) ?? null,
    latestRuns: latestRuns as unknown as GenerationRun[],
    sources: sourcesRows as unknown as Array<{
      name: string;
      type: string;
      enabled: boolean;
      last_run_at: string | null;
      last_success_at: string | null;
      last_error: string | null;
    }>,
  };
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

function scoreColor(score: number) {
  if (score >= 80) return "bg-emerald-500";
  if (score >= 65) return "bg-brand-500";
  if (score >= 45) return "bg-amber-500";
  return "bg-slate-400";
}

export default async function DashboardPage() {
  const state = envState();

  // If DATABASE_URL is missing, short-circuit to the setup wizard
  if (!state.databaseUrl) {
    return (
      <SetupNeeded
        state={state}
        errorMessage="DATABASE_URL environment variable is not set in Netlify."
      />
    );
  }

  // Try to load stats — if the schema isn't applied yet, show setup wizard
  let stats: Awaited<ReturnType<typeof getStats>>;
  try {
    stats = await getStats();
    state.schemaApplied = true;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const looksLikeSchema =
      /relation .* does not exist|does not exist|table/i.test(msg);
    if (looksLikeSchema) {
      return (
        <SetupNeeded
          state={state}
          errorMessage={`Database is connected, but the schema hasn't been applied. ${msg}`}
        />
      );
    }
    // Any other DB error: let the error boundary handle it
    throw err;
  }

  const { totals, topLeads, latestRun, latestRuns, sources } = stats;
  const stats_cards = [
    { label: "Leads (last 24h)", value: totals.last24, icon: Sparkles, color: "text-brand-600" },
    { label: "Qualified (7d)", value: totals.qualified7d, icon: TrendingUp, color: "text-emerald-600" },
    { label: "East Coast (7d)", value: totals.eastCoast7d, icon: MapPin, color: "text-amber-600" },
    { label: "Open opportunities", value: totals.openOpps, icon: Target, color: "text-violet-600" },
    { label: "Total leads", value: totals.all, icon: Users, color: "text-slate-600" },
  ];

  // No leads yet? Show the SystemStatus verification panel instead of empty UI.
  if (totals.all === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Dashboard</h1>
          <p className="text-slate-500 mt-1">
            Aventis Leads · autonomous discovery for Aventis Marketing & AventisAI
          </p>
        </div>
        <SystemStatus lastRun={latestRun} sources={sources} />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Dashboard</h1>
          <p className="text-slate-500 mt-1">
            Aventis Leads · autonomous discovery for Aventis Marketing & AventisAI
          </p>
        </div>
        <div className="text-right text-sm">
          <div className="text-slate-500">Last cycle</div>
          <div className="font-medium text-slate-900">
            {timeAgo(latestRun?.completed_at ?? latestRun?.started_at ?? null)}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {stats_cards.map((s) => {
          const Icon = s.icon;
          return (
            <div key={s.label} className="bg-white rounded-xl border border-slate-200 p-5 hover:shadow-sm transition">
              <div className="flex items-center justify-between">
                <Icon className={`w-5 h-5 ${s.color}`} />
              </div>
              <div className="mt-3 text-3xl font-bold text-slate-900">{s.value}</div>
              <div className="text-xs text-slate-500 mt-1">{s.label}</div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200">
          <div className="flex items-center justify-between p-5 border-b border-slate-200">
            <h2 className="font-semibold text-slate-900">Top leads</h2>
            <Link href="/leads" className="text-sm text-brand-600 hover:underline">View all →</Link>
          </div>
          <ul className="divide-y divide-slate-100">
            {topLeads.length === 0 ? (
              <li className="p-8 text-center text-sm text-slate-500">
                No leads yet. The first batch will arrive within 4 hours.
              </li>
            ) : (
              topLeads.map((l) => (
                <li key={l.id} className="p-4 hover:bg-slate-50 transition">
                  <Link href={`/leads/${l.id}`} className="flex items-center gap-4">
                    <div className={`score-pill ${scoreColor(l.lead_score)}`}>{l.lead_score}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <div className="font-medium text-slate-900 truncate">
                          {l.company_name || l.person_name || "Unknown"}
                        </div>
                        {l.is_east_coast && <span className="status-badge bg-blue-50 text-blue-700">East Coast</span>}
                        <span className="status-badge bg-slate-100 text-slate-600">{l.source}</span>
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5 truncate">
                        {l.intent_signal ?? "(no signal text)"}
                      </div>
                    </div>
                    <div className="text-xs text-slate-400 shrink-0">{timeAgo(l.created_at)}</div>
                  </Link>
                </li>
              ))
            )}
          </ul>
        </div>

        <div className="bg-white rounded-xl border border-slate-200">
          <div className="p-5 border-b border-slate-200">
            <h2 className="font-semibold text-slate-900 flex items-center gap-2">
              <Clock className="w-4 h-4 text-slate-400" /> Recent cycles
            </h2>
          </div>
          <ul className="divide-y divide-slate-100">
            {latestRuns.length === 0 ? (
              <li className="p-6 text-sm text-slate-500 text-center">No cycles yet.</li>
            ) : (
              latestRuns.map((r) => (
                <li key={r.id} className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="text-xs text-slate-500">{timeAgo(r.started_at)}</div>
                    <span className={`status-badge ${
                      r.status === "completed" ? "bg-emerald-50 text-emerald-700"
                      : r.status === "running" ? "bg-blue-50 text-blue-700"
                      : "bg-red-50 text-red-700"
                    }`}>
                      {r.status}
                    </span>
                  </div>
                  <div className="mt-2 grid grid-cols-3 gap-2 text-center">
                    <div>
                      <div className="text-lg font-semibold text-slate-900">{r.leads_created}</div>
                      <div className="text-[10px] text-slate-500 uppercase">New</div>
                    </div>
                    <div>
                      <div className="text-lg font-semibold text-slate-900">{r.leads_researched}</div>
                      <div className="text-[10px] text-slate-500 uppercase">Researched</div>
                    </div>
                    <div>
                      <div className="text-lg font-semibold text-emerald-600">{r.leads_qualified}</div>
                      <div className="text-[10px] text-slate-500 uppercase">Qualified</div>
                    </div>
                  </div>
                </li>
              ))
            )}
          </ul>
        </div>
      </div>
    </div>
  );
}
