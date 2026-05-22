import type { Config } from "@netlify/functions";
import { runDeepResearchCycle } from "../../lib/pipeline";
import { log } from "../../lib/db";

/**
 * Continuous research worker — runs every 30 minutes between batches
 * to deepen analysis on any pending leads, so each lead is as
 * high-quality as possible by the time you see it.
 */
export default async (_req: Request) => {
  try {
    const result = await runDeepResearchCycle();
    return new Response(JSON.stringify({ ok: true, ...result }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await log("error", "cron_deep_research_failed", msg).catch(() => {});
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};

export const config: Config = {
  schedule: "*/30 * * * *",
};
