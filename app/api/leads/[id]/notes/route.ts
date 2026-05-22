import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { content } = (await req.json()) as { content: string };
  if (!content?.trim()) return NextResponse.json({ error: "empty" }, { status: 400 });

  const { data, error } = await db()
    .from("lead_activities")
    .insert({
      lead_id: id,
      type: "note",
      content,
      created_by: "user",
    })
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ activity: data });
}
