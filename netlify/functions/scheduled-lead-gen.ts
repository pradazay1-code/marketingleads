import type { Config } from "@netlify/functions";
import { runLeadGenerationCycle } from "../../lib/pipeline";
import { log } from "../../lib/db";

/**
 * Main 4-hour lead-generation cycle.
 *
 * Runs at 00:00, 04:00, 08:00, 12:00, 16:00, 20:00 UTC.
 * Schedule is set in netlify.toml.
 */
export default async (_req: Request) => {
  try {
    const result = await runLeadGenerationCycle();
    return new Response(JSON.stringify({ ok: true, ...result }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await log("error", "cron_lead_gen_failed", msg).catch(() => {});
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};

export const config: Config = {
  schedule: "0 */4 * * *",
};
