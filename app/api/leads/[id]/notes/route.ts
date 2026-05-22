import { NextRequest, NextResponse } from "next/server";
import { insertRow } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { content } = (await req.json()) as { content: string };
  if (!content?.trim()) {
    return NextResponse.json({ error: "empty" }, { status: 400 });
  }

  try {
    const activity = await insertRow("lead_activities", {
      lead_id: id,
      type: "note",
      content,
      created_by: "user",
    });
    return NextResponse.json({ activity });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
