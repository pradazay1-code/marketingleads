import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const body = (await req.json()) as { phrase: string; category?: string; weight?: number };
  if (!body.phrase?.trim()) return NextResponse.json({ error: "phrase required" }, { status: 400 });
  const { data, error } = await db()
    .from("keywords")
    .insert({
      phrase: body.phrase.trim().toLowerCase(),
      category: body.category ?? "intent",
      weight: Math.max(1, Math.min(10, body.weight ?? 5)),
    })
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ keyword: data });
}
