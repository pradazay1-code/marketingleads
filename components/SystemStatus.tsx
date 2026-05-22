"use client";

import { useState } from "react";
import {
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2,
  Play,
  RefreshCw,
  ExternalLink,
} from "lucide-react";

interface SourceHealth {
  name: string;
  type: string;
  enabled: boolean;
  last_run_at: string | null;
  last_success_at: string | null;
  last_error: string | null;
}

interface CronRun {
  id: string;
  started_at: string;
  completed_at: string | null;
  status: string;
  raw_signals_found: number;
  leads_created: number;
  leads_qualified: number;
}

export default function SystemStatus({
  lastRun,
  sources,
}: {
  lastRun: CronRun | null;
  sources: SourceHealth[];
}) {
  const [secret, setSecret] = useState("");
  const [running, setRunning] = useState(false);
  const [runResult, setRunResult] = useState<{ ok: boolean; data?: Record<string, unknown>; error?: string } | null>(
    null
  );

  async function runNow() {
    if (!secret) {
      setRunResult({ ok: false, error: "Enter your CRON_SECRET first." });
      return;
    }
    setRunning(true);
    setRunResult(null);
    try {
      const res = await fetch("/api/manual-run", {
        method: "POST",
        headers: { Authorization: `Bearer ${secret}` },
      });
      const data = await res.json();
      if (res.ok) {
        setRunResult({ ok: true, data });
      } else {
        setRunResult({ ok: false, error: data.error ?? `HTTP ${res.status}` });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setRunResult({ ok: false, error: msg });
    } finally {
      setRunning(false);
      // After completing, refresh the page to load any new leads
      if (typeof window !== "undefined") {
        setTimeout(() => window.location.reload(), 1500);
      }
    }
  }

  function timeAgo(iso: string | null): string {
    if (!iso) return "never";
    const diff = Date.now() - new Date(iso).getTime();
    const m = Math.floor(diff / 60_000);
    if (m < 1) return "just now";
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
  }

  const cronHasFired = lastRun !== null;

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-amber-500" />
          No leads yet — let&apos;s verify everything is working
        </h2>
        <p className="text-sm text-slate-600 mt-1">
          The system runs every 4 hours at 0, 4, 8, 12, 16, 20 UTC. If you just deployed,
          you may need to wait — or trigger a run manually below.
        </p>

        <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Cron status */}
          <div className="border border-slate-200 rounded-lg p-4">
            <div className="text-xs uppercase font-medium text-slate-500 mb-2">Cron job</div>
            {cronHasFired ? (
              <div>
                <div className="flex items-center gap-2 text-emerald-700">
                  <CheckCircle2 className="w-4 h-4" />
                  <span className="font-medium">Last ran {timeAgo(lastRun!.started_at)}</span>
                </div>
                <div className="text-sm text-slate-600 mt-2 space-y-0.5">
                  <div>Status: <span className="font-medium">{lastRun!.status}</span></div>
                  <div>{lastRun!.raw_signals_found} raw signals fetched</div>
                  <div>{lastRun!.leads_created} new leads created</div>
                  <div>{lastRun!.leads_qualified} qualified (score ≥65)</div>
                </div>
              </div>
            ) : (
              <div>
                <div className="flex items-center gap-2 text-amber-700">
                  <AlertCircle className="w-4 h-4" />
                  <span className="font-medium">Has not fired yet</span>
                </div>
                <div className="text-sm text-slate-600 mt-2">
                  The first scheduled run is at the next 0, 4, 8, 12, 16, or 20 UTC mark. Or
                  trigger it now with the button below.
                </div>
              </div>
            )}
          </div>

          {/* Where to check Netlify */}
          <div className="border border-slate-200 rounded-lg p-4">
            <div className="text-xs uppercase font-medium text-slate-500 mb-2">
              Netlify function logs
            </div>
            <div className="text-sm text-slate-600 space-y-2">
              <p>To see live cron execution logs:</p>
              <ol className="list-decimal list-inside space-y-0.5 text-xs">
                <li>Open Netlify dashboard</li>
                <li>Click <strong>Functions</strong> in the left sidebar</li>
                <li>Click <strong>scheduled-lead-gen</strong></li>
                <li>See last invocation time + logs</li>
              </ol>
            </div>
          </div>
        </div>

        {/* Sources health */}
        <div className="mt-5">
          <div className="text-xs uppercase font-medium text-slate-500 mb-2">
            Source health ({sources.filter((s) => s.enabled).length} enabled)
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-sm">
            {sources.map((s) => {
              const status = !s.enabled
                ? "disabled"
                : s.last_error
                ? "error"
                : s.last_success_at
                ? "ok"
                : "pending";
              const Icon =
                status === "ok"
                  ? CheckCircle2
                  : status === "error"
                  ? XCircle
                  : status === "disabled"
                  ? XCircle
                  : AlertCircle;
              const color =
                status === "ok"
                  ? "text-emerald-600"
                  : status === "error"
                  ? "text-red-600"
                  : status === "disabled"
                  ? "text-slate-400"
                  : "text-amber-600";
              return (
                <div
                  key={s.name}
                  className="flex items-center gap-2 p-2 rounded border border-slate-100"
                  title={s.last_error ?? ""}
                >
                  <Icon className={`w-4 h-4 shrink-0 ${color}`} />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-slate-900 truncate">{s.name}</div>
                    <div className="text-xs text-slate-500 truncate">
                      {!s.enabled
                        ? "disabled in settings"
                        : s.last_error
                        ? s.last_error.slice(0, 60)
                        : s.last_success_at
                        ? `last ok ${timeAgo(s.last_success_at)}`
                        : "never run"}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Run now */}
        <div className="mt-6 pt-5 border-t border-slate-200">
          <div className="text-xs uppercase font-medium text-slate-500 mb-2">
            Trigger a cycle right now
          </div>
          <p className="text-sm text-slate-600 mb-3">
            Bypasses the 4-hour schedule. Takes ~30-90 seconds depending on AI research load.
            You should get a push notification on your phone if any leads score ≥65.
          </p>
          <div className="flex gap-2">
            <input
              type="password"
              value={secret}
              onChange={(e) => setSecret(e.target.value)}
              placeholder="Paste CRON_SECRET (same value as in Netlify env vars)"
              className="flex-1 border border-slate-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
            <button
              onClick={runNow}
              disabled={running || !secret}
              className="bg-brand-500 hover:bg-brand-600 text-white px-4 py-2 rounded-md text-sm flex items-center gap-2 disabled:opacity-50"
            >
              {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
              {running ? "Running..." : "Run Now"}
            </button>
          </div>
          {runResult && (
            <div
              className={`mt-3 rounded-md p-3 text-sm ${
                runResult.ok
                  ? "bg-emerald-50 border border-emerald-200 text-emerald-800"
                  : "bg-red-50 border border-red-200 text-red-800"
              }`}
            >
              {runResult.ok ? (
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Cycle complete. Page will refresh in 1.5s…</span>
                </div>
              ) : (
                <div className="flex items-start gap-2">
                  <XCircle className="w-4 h-4 mt-0.5 shrink-0" />
                  <div>
                    <div className="font-medium">{runResult.error}</div>
                    {runResult.error?.includes("unauthorized") && (
                      <div className="text-xs mt-1">
                        That CRON_SECRET doesn&apos;t match what&apos;s in Netlify. Copy the exact value
                        from Site configuration → Environment variables.
                      </div>
                    )}
                  </div>
                </div>
              )}
              {runResult.data && (
                <pre className="mt-2 text-xs bg-white/50 p-2 rounded overflow-auto">
                  {JSON.stringify(runResult.data, null, 2)}
                </pre>
              )}
            </div>
          )}
        </div>

        <div className="mt-5 flex items-center gap-4 text-sm">
          <a
            href="/api/health"
            target="_blank"
            rel="noreferrer"
            className="text-brand-600 hover:underline flex items-center gap-1"
          >
            Full diagnostic JSON <ExternalLink className="w-3 h-3" />
          </a>
          <button
            onClick={() => window.location.reload()}
            className="text-slate-600 hover:underline flex items-center gap-1"
          >
            <RefreshCw className="w-3 h-3" /> Refresh page
          </button>
        </div>
      </div>
    </div>
  );
}
