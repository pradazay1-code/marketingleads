import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Diagnostic endpoint — hit this any time something's broken or to verify
 * the system is alive. Reports env config, DB health, schema status,
 * cron history, source health, and recent leads count.
 *
 * No auth — never leaks secret values, only presence/absence.
 */
export async function GET() {
  const result: Record<string, unknown> = {
    ok: true,
    checks: {} as Record<string, unknown>,
    summary: [] as string[],
  };
  const checks = result.checks as Record<string, unknown>;
  const summary = result.summary as string[];

  // -------- Environment variables --------
  const required = ["DATABASE_URL", "GEMINI_API_KEY", "NTFY_TOPIC", "CRON_SECRET"];
  const recommended = [
    "FIRECRAWL_API_KEY",
    "GOOGLE_PLACES_API_KEY",
    "MAPBOX_TOKEN",
    "NEXT_PUBLIC_MAPBOX_TOKEN",
    "RESEND_API_KEY",
    "NOTIFY_TO_EMAIL",
    "NOTIFY_FROM_EMAIL",
    "GROQ_API_KEY",
    "NEXT_PUBLIC_SITE_URL",
  ];
  const optional = [
    "GOOGLE_API_KEY",
    "GOOGLE_CSE_ID",
    "TWITTER_BEARER_TOKEN",
    "PRODUCTHUNT_TOKEN",
    "TELEGRAM_BOT_TOKEN",
    "TELEGRAM_CHAT_ID",
    "OPENCORPORATES_API_TOKEN",
    "SCRAPER_API_KEY",
    "APP_PASSWORD",
  ];

  const env: Record<string, "set" | "missing"> = {};
  for (const k of [...required, ...recommended, ...optional]) {
    env[k] = process.env[k] ? "set" : "missing";
  }
  checks.environment = env;

  const missingRequired = required.filter((k) => !process.env[k]);
  if (missingRequired.length > 0) {
    result.ok = false;
    summary.push(`❌ Missing required env vars: ${missingRequired.join(", ")}`);
  } else {
    summary.push("✅ All required env vars are set");
  }

  const missingRecommended = recommended.filter((k) => !process.env[k]);
  if (missingRecommended.length > 0) {
    summary.push(
      `⚠️  Missing recommended env vars: ${missingRecommended.join(", ")} (system works without them but functionality is reduced)`
    );
  }

  // -------- Database connectivity --------
  let dbOk = false;
  if (process.env.DATABASE_URL) {
    try {
      const { neon } = await import("@neondatabase/serverless");
      const sql = neon(process.env.DATABASE_URL);
      const start = Date.now();
      const r = (await sql`SELECT 1 AS ok`) as Array<{ ok: number }>;
      const ms = Date.now() - start;
      if (r[0]?.ok === 1) {
        checks.database = { status: "ok", latency_ms: ms };
        summary.push(`✅ Database reachable (${ms}ms)`);
        dbOk = true;
      } else {
        checks.database = { status: "unexpected_result", result: r };
        summary.push("⚠️  Database returned unexpected result");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      checks.database = { status: "failed", error: msg };
      summary.push(`❌ Database connection failed: ${msg}`);
      result.ok = false;
    }
  } else {
    checks.database = { status: "not_configured" };
  }

  // -------- Schema check + live data snapshot --------
  let schemaOk = false;
  if (dbOk) {
    try {
      const { neon } = await import("@neondatabase/serverless");
      const sql = neon(process.env.DATABASE_URL!);
      const required_tables = [
        "leads",
        "lead_activities",
        "opportunities",
        "generation_runs",
        "keywords",
        "sources",
        "notifications",
        "system_log",
      ];
      const rows = (await sql`
        SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'
      `) as Array<{ table_name: string }>;
      const found = new Set(rows.map((r) => r.table_name));
      const missing = required_tables.filter((t) => !found.has(t));

      if (missing.length === 0) {
        checks.schema = { status: "ok", tables: required_tables.length };
        summary.push(`✅ All ${required_tables.length} tables present`);
        schemaOk = true;
      } else {
        checks.schema = { status: "incomplete", missing };
        summary.push(
          `❌ Schema not applied — missing tables: ${missing.join(", ")}. Run db/schema.sql in the Neon SQL Editor.`
        );
        result.ok = false;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      checks.schema = { status: "error", error: msg };
      summary.push(`⚠️  Could not check schema: ${msg}`);
    }
  }

  // -------- Live data: cron history, source health, lead counts --------
  if (schemaOk) {
    try {
      const { neon } = await import("@neondatabase/serverless");
      const sql = neon(process.env.DATABASE_URL!);

      const recentRuns = (await sql`
        SELECT id, started_at, completed_at, status,
               raw_signals_found, leads_created, leads_researched,
               leads_qualified, notification_sent, errors
        FROM generation_runs
        ORDER BY started_at DESC
        LIMIT 5
      `) as Array<Record<string, unknown>>;
      checks.recent_cron_runs = recentRuns;

      const lastRun = recentRuns[0];
      if (!lastRun) {
        summary.push(
          "⏳ The cron has not fired yet. First scheduled run is within 4 hours of deploy (every 0/4/8/12/16/20 UTC). Use Settings → Run Now to trigger immediately."
        );
      } else {
        const startedAt = new Date(lastRun.started_at as string);
        const minsAgo = Math.floor((Date.now() - startedAt.getTime()) / 60000);
        const status = lastRun.status;
        const signals = lastRun.raw_signals_found ?? 0;
        const created = lastRun.leads_created ?? 0;
        const qualified = lastRun.leads_qualified ?? 0;
        summary.push(
          `🕐 Last cycle ${minsAgo}m ago — ${status}, ${signals} signals → ${created} leads → ${qualified} qualified`
        );
      }

      const sourceHealth = (await sql`
        SELECT name, type, enabled, last_run_at, last_success_at, last_error
        FROM sources ORDER BY name
      `) as Array<{
        name: string;
        type: string;
        enabled: boolean;
        last_run_at: string | null;
        last_success_at: string | null;
        last_error: string | null;
      }>;
      checks.sources = sourceHealth;
      const failing = sourceHealth.filter((s) => s.enabled && s.last_error);
      if (failing.length > 0) {
        summary.push(
          `⚠️  ${failing.length} source(s) currently failing: ${failing.map((s) => s.name).join(", ")}`
        );
      }

      const counts = (await sql`
        SELECT
          (SELECT COUNT(*) FROM leads)::int AS total_leads,
          (SELECT COUNT(*) FROM leads WHERE created_at >= now() - interval '24 hours')::int AS leads_24h,
          (SELECT COUNT(*) FROM leads WHERE lead_score >= 65)::int AS qualified_leads,
          (SELECT COUNT(*) FROM leads WHERE research_status = 'pending')::int AS pending_research,
          (SELECT COUNT(*) FROM keywords WHERE enabled = true)::int AS active_keywords,
          (SELECT COUNT(*) FROM sources WHERE enabled = true)::int AS active_sources,
          (SELECT COUNT(*) FROM notifications WHERE status = 'sent')::int AS notifications_sent,
          (SELECT COUNT(*) FROM leads WHERE vertical = 'junk_removal')::int AS junk_removal_leads,
          (SELECT COUNT(*) FROM leads WHERE vertical = 'real_estate')::int AS real_estate_leads,
          (SELECT COUNT(*) FROM leads WHERE latitude IS NOT NULL)::int AS geocoded_leads
      `) as Array<Record<string, number>>;
      checks.data_counts = counts[0];

      const recentLogs = (await sql`
        SELECT level, event, message, created_at
        FROM system_log
        ORDER BY created_at DESC
        LIMIT 10
      `) as Array<Record<string, unknown>>;
      checks.recent_log = recentLogs;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      summary.push(`⚠️  Could not load live data: ${msg}`);
    }
  }

  // -------- AI provider --------
  const aiProvider = (process.env.AI_PROVIDER || "gemini").toLowerCase();
  if (aiProvider === "gemini" && !process.env.GEMINI_API_KEY) {
    checks.ai = { status: "not_configured", expected: "GEMINI_API_KEY" };
    summary.push("❌ AI_PROVIDER=gemini but GEMINI_API_KEY is not set");
    result.ok = false;
  } else if (aiProvider === "groq" && !process.env.GROQ_API_KEY) {
    checks.ai = { status: "not_configured", expected: "GROQ_API_KEY" };
    summary.push("❌ AI_PROVIDER=groq but GROQ_API_KEY is not set");
    result.ok = false;
  } else {
    checks.ai = { provider: aiProvider, status: "configured" };
    summary.push(`✅ AI research provider: ${aiProvider}`);
  }

  // -------- Notification channels --------
  const channels: Record<string, boolean> = {
    ntfy: !!process.env.NTFY_TOPIC,
    telegram: !!process.env.TELEGRAM_BOT_TOKEN && !!process.env.TELEGRAM_CHAT_ID,
    email: !!process.env.RESEND_API_KEY && !!process.env.NOTIFY_TO_EMAIL,
  };
  checks.notification_channels = channels;
  const active = Object.entries(channels)
    .filter(([, v]) => v)
    .map(([k]) => k);
  if (active.length === 0) {
    summary.push("❌ No notification channels configured — you won't get notified about leads");
    result.ok = false;
  } else {
    summary.push(`✅ Notification channels active: ${active.join(", ")}`);
  }

  if (!process.env.NEXT_PUBLIC_SITE_URL) {
    summary.push("⚠️  NEXT_PUBLIC_SITE_URL not set — notification links will be broken");
  }

  return NextResponse.json(result, {
    status: result.ok ? 200 : 503,
    headers: { "Cache-Control": "no-store" },
  });
}
