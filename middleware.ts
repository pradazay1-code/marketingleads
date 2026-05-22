import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const SESSION_COOKIE = "aventis_session";
const PUBLIC_PATHS = new Set(["/login"]);
const PUBLIC_API_PREFIXES = ["/api/auth/", "/api/health"];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Always forward the pathname as a request header so layouts can read it
  const passthroughHeaders = new Headers(req.headers);
  passthroughHeaders.set("x-pathname", pathname);
  const pass = () => NextResponse.next({ request: { headers: passthroughHeaders } });

  // Static assets always allowed
  if (
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/favicon") ||
    pathname.includes(".") // file extensions like .css, .js, .png, .ico
  ) {
    return pass();
  }

  // If DATABASE_URL isn't configured, send everyone to / for the setup wizard.
  // (API routes including /api/health remain reachable.)
  if (!process.env.DATABASE_URL) {
    if (
      pathname === "/" ||
      pathname.startsWith("/api/health") ||
      pathname.startsWith("/api/")
    ) {
      return pass();
    }
    return NextResponse.redirect(new URL("/", req.url));
  }

  // Auth gate (only enforced if APP_PASSWORD is set)
  const authEnabled = !!process.env.APP_PASSWORD;
  if (authEnabled) {
    // Always allow login page + auth endpoints + health
    if (PUBLIC_PATHS.has(pathname)) return pass();
    if (PUBLIC_API_PREFIXES.some((p) => pathname.startsWith(p))) {
      return pass();
    }

    const sessionToken = req.cookies.get(SESSION_COOKIE)?.value;
    if (!sessionToken) {
      if (pathname.startsWith("/api/")) {
        return NextResponse.json({ error: "unauthorized" }, { status: 401 });
      }
      const loginUrl = new URL("/login", req.url);
      loginUrl.searchParams.set("next", pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  return pass();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon).*)"],
};
