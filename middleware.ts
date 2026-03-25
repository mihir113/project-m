import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE_NAME } from "@/lib/auth";

function isPublicPath(pathname: string) {
  return pathname === "/login" || pathname.startsWith("/_next") || pathname === "/favicon.ico";
}

function isCronAuthorized(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return false;
  const token = req.headers.get("x-cron-secret");
  return token === cronSecret;
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (isPublicPath(pathname) || pathname.startsWith("/api/auth/")) {
    return NextResponse.next();
  }

  const appAuthToken = process.env.APP_AUTH_TOKEN;
  if (!appAuthToken) {
    return NextResponse.json(
      { error: "APP_AUTH_TOKEN is not configured" },
      { status: 500 }
    );
  }

  const hasAuthCookie = req.cookies.get(AUTH_COOKIE_NAME)?.value === appAuthToken;
  if (hasAuthCookie) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    if (isCronAuthorized(req)) return NextResponse.next();
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const loginUrl = new URL("/login", req.url);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|manifest.json|icon-192x192.png|icon-512x512.png).*)"],
};
