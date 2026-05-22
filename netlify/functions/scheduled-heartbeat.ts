import type { Config } from "@netlify/functions";
import { db, log } from "../../lib/db";

/**
 * Hourly heartbeat — confirms the cron infrastructure is alive,
 * cleans up old logs, and surfaces any sources that have been failing.
 */
export default async (_req: Request) => {
  try {
    // health: count leads in the last 24h
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count: leadCount } = await db()
      .from("leads")
      .select("*", { count: "exact", head: true })
      .gte("created_at", since);

    // find sources that have been failing > 24h
    const { data: staleSources } = await db()
      .from("sources")
      .select("name, last_success_at, last_error")
      .lt("last_success_at", since);

    // Trim system_log to last 14 days
    const cutoff = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
    await db().from("system_log").delete().lt("created_at", cutoff);

    await log("info", "heartbeat", `Alive. ${leadCount ?? 0} leads in last 24h.`, {
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
