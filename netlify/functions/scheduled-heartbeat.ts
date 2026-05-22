import type { Config } from "@netlify/functions";
import { db, log, countRows } from "../../lib/db";

/**
 * Hourly heartbeat — confirms the cron infrastructure is alive,
 * cleans up old logs, and surfaces any sources that have been failing.
 */
export default async (_req: Request) => {
  try {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const sql = db();

    const leadCount = await countRows("leads", "WHERE created_at >= $1", [since]);

    const staleSources = (await sql`
      SELECT name, last_success_at, last_error
      FROM sources
      WHERE last_success_at IS NULL OR last_success_at < ${since}
    `) as Array<{ name: string; last_success_at: string | null; last_error: string | null }>;

    // Trim system_log to last 14 days
    const cutoff = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
    await sql`DELETE FROM system_log WHERE created_at < ${cutoff}`;

    await log("info", "heartbeat", `Alive. ${leadCount} leads in last 24h.`, {
      stale_sources: staleSources,
    });
    return new Response(
      JSON.stringify({ ok: true, leadsLast24h: leadCount, staleSources }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};

export const config: Config = {
  schedule: "0 * * * *",
};
