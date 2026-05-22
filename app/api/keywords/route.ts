import { NextRequest, NextResponse } from "next/server";
import { insertRow } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const body = (await req.json()) as { phrase: string; category?: string; weight?: number };
  if (!body.phrase?.trim()) {
    return NextResponse.json({ error: "phrase required" }, { status: 400 });
  }
  try {
    const keyword = await insertRow("keywords", {
      phrase: body.phrase.trim().toLowerCase(),
      category: body.category ?? "intent",
      weight: Math.max(1, Math.min(10, body.weight ?? 5)),
    });
    return NextResponse.json({ keyword });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
