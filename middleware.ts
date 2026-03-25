import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

function isPublicPath(pathname: string) {
  return pathname === "/login" || pathname.startsWith("/_next") || pathname === "/favicon.ico";
}

function isCronAuthorized(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return false;
  const token = req.headers.get("x-cron-secret");
  return token === cronSecret;
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json({ error: "Supabase env vars are not configured" }, { status: 500 });
  }

  const res = NextResponse.next();
  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return req.cookies.getAll();
      },
      setAll() {
        // no-op in middleware; session refresh is handled by client auth flow
      },
    },
  });

  const { data, error } = await supabase.auth.getUser();
  const isAuthed = Boolean(!error && data.user);

  if (isAuthed && pathname === "/login") {
    return NextResponse.redirect(new URL("/", req.url));
  }

  if (isAuthed) return res;

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
