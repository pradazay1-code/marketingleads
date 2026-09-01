import { NextRequest } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

const COLUMNS = [
  "id",
  "lead_score",
  "contactability_score",
  "vertical",
  "estimated_monthly_value",
  "status",
  "source",
  "company_name",
  "person_name",
  "email",
  "phone",
  "website",
  "location",
  "state",
  "is_east_coast",
  "industry",
  "intent_signal",
  "intent_category",
  "outreach_angle",
  "outreach_email_draft",
  "outreach_dm_draft",
  "outreach_phone_script",
  "uses_lead_marketplace",
  "research_summary",
  "source_url",
  "created_at",
];

function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return "";
  const s = String(value).replace(/\r?\n/g, " ").replace(/"/g, '""');
  return /[",\n]/.test(s) ? `"${s}"` : s;
}

export async function GET(req: NextRequest) {
  const sql = db();
  const params = req.nextUrl.searchParams;

  const conditions: string[] = [];
  const sqlParams: unknown[] = [];
  const push = (clause: string, value: unknown) => {
    sqlParams.push(value);
    conditions.push(clause.replace("?", `$${sqlParams.length}`));
  };
  if (params.get("status")) push("status = ?", params.get("status"));
  if (params.get("source")) push("source = ?", params.get("source"));
  if (params.get("vertical")) push("vertical = ?", params.get("vertical"));
  if (params.get("contactable") !== "0") conditions.push("contactability_score >= 45");
  if (params.get("east") === "1") conditions.push("is_east_coast = true");
  if (params.get("min_score")) push("lead_score >= ?", parseInt(params.get("min_score")!, 10));

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const rows = (await sql(
    `SELECT ${COLUMNS.join(", ")} FROM leads ${where}
     ORDER BY lead_score DESC, created_at DESC LIMIT 5000`,
    sqlParams
  )) as Array<Record<string, unknown>>;

  const header = COLUMNS.join(",");
  const csvRows = rows.map((row) => COLUMNS.map((c) => csvEscape(row[c])).join(","));
  const csv = [header, ...csvRows].join("\n");

  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="aventis-leads-${stamp}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
