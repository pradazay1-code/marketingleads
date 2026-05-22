import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * Global search across leads (company name, person, intent, summary, location).
 * Returns up to 30 matches with the most relevant fields for display.
 */
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) return NextResponse.json({ results: [] });

  const sql = db();
  const pattern = `%${q}%`;
  const rows = (await sql(
    `SELECT id, company_name, person_name, intent_signal, source, lead_score,
            status, location, is_east_coast, created_at, research_summary
     FROM leads
     WHERE company_name ILIKE $1
        OR person_name ILIKE $1
        OR intent_signal ILIKE $1
        OR research_summary ILIKE $1
        OR location ILIKE $1
        OR email ILIKE $1
     ORDER BY lead_score DESC, created_at DESC
     LIMIT 30`,
    [pattern]
  )) as Array<Record<string, unknown>>;

  return NextResponse.json({ results: rows });
}
