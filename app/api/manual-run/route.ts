import { NextRequest, NextResponse } from "next/server";
import { runLeadGenerationCycle } from "@/lib/pipeline";
import { insertRow } from "@/lib/db";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Manual trigger — runs the full 4-hour cycle on demand.
 * Protected by CRON_SECRET. Use this from the Settings page.
 */
export async function POST(req: NextRequest) {
  const auth = req.headers.get("authorization") || "";
  const secret = process.env.CRON_SECRET;
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const result = await runLeadGenerationCycle();
    await insertRow("audit_log", {
      action: "manual_run",
      resource_type: "generation_run",
      resource_id: result.runId,
      metadata: result,
    }).catch(() => null);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
