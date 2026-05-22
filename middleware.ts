import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * If DATABASE_URL isn't configured, redirect all UI pages to the home
 * page where the setup wizard lives. API routes (including /api/health)
 * are always allowed so the diagnostic endpoint works.
 */
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Always allow API routes, the home page, and static assets
  if (
    pathname.startsWith("/api/") ||
    pathname === "/" ||
    pathname.startsWith("/_next/") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  if (!process.env.DATABASE_URL) {
    return NextResponse.redirect(new URL("/", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon).*)"],
};
