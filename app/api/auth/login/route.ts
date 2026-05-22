import { NextRequest, NextResponse } from "next/server";
import { checkPassword, createSession, isAuthEnabled, SESSION_COOKIE_NAME, SESSION_MAX_AGE_SECONDS } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  if (!isAuthEnabled()) {
    return NextResponse.json({ error: "auth_not_configured" }, { status: 400 });
  }
  const body = (await req.json().catch(() => null)) as { password?: string } | null;
  if (!body?.password || !checkPassword(body.password)) {
    // small delay to slow brute force
    await new Promise((r) => setTimeout(r, 600));
    return NextResponse.json({ error: "invalid_password" }, { status: 401 });
  }

  const token = await createSession();
  const res = NextResponse.json({ ok: true });
  res.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: token,
    httpOnly: true,
    sameSite: "lax",
    secure: true,
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
  return res;
}
