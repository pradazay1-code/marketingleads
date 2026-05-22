import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Diagnostic endpoint — hit this any time something's broken.
 * Tells you exactly which env vars are set, whether the DB is reachable,
 * and whether the schema has been applied.
 *
 * No auth required — it never leaks secrets, only reports presence/absence.
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
  const recommended = ["RESEND_API_KEY", "NOTIFY_TO_EMAIL", "NOTIFY_FROM_EMAIL", "GROQ_API_KEY", "NEXT_PUBLIC_SITE_URL"];
  const optional = [
    "GOOGLE_API_KEY",
    "GOOGLE_CSE_ID",
    "TWITTER_BEARER_TOKEN",
    "PRODUCTHUNT_TOKEN",
    "TELEGRAM_BOT_TOKEN",
    "TELEGRAM_CHAT_ID",
    "OPENCORPORATES_API_TOKEN",
    "SCRAPER_API_KEY",
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
    summary.push(`⚠️  Missing recommended env vars: ${missingRecommended.join(", ")} (system works without them but functionality is reduced)`);
  }

  // -------- Database connectivity --------
  if (process.env.DATABASE_URL) {
    try {
      const { neon } = await import("@neondatabase/serverless");
      const sql = neon(process.env.DATABASE_URL);
      const start = Date.now();
      const result = (await sql`SELECT 1 AS ok`) as Array<{ ok: number }>;
      const ms = Date.now() - start;
      if (result[0]?.ok === 1) {
        checks.database = { status: "ok", latency_ms: ms };
        summary.push(`✅ Database reachable (${ms}ms)`);
      } else {
        checks.database = { status: "unexpected_result", result };
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

  // -------- Schema check --------
  if (process.env.DATABASE_URL && (checks.database as { status: string }).status === "ok") {
    try {
      const { neon } = await import("@neondatabase/serverless");
      const sql = neon(process.env.DATABASE_URL);
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
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public'
      `) as Array<{ table_name: string }>;
      const found = new Set(rows.map((r) => r.table_name));
      const missing = required_tables.filter((t) => !found.has(t));
      if (missing.length === 0) {
        checks.schema = { status: "ok", tables: required_tables.length };
        summary.push(`✅ All ${required_tables.length} tables present`);
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

  // -------- Site URL --------
  if (!process.env.NEXT_PUBLIC_SITE_URL) {
    summary.push("⚠️  NEXT_PUBLIC_SITE_URL not set — notification links will be broken");
  }

  return NextResponse.json(result, {
    status: result.ok ? 200 : 503,
    headers: { "Cache-Control": "no-store" },
  });
}
