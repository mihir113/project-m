import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE_NAME } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const appPassword = process.env.APP_AUTH_PASSWORD;
    const appToken = process.env.APP_AUTH_TOKEN;
    if (!appPassword || !appToken) {
      return NextResponse.json({ error: "Auth env vars not configured" }, { status: 500 });
    }

    const body = await req.json();
    const password = String(body?.password || "");
    if (password !== appPassword) {
      return NextResponse.json({ error: "Invalid password" }, { status: 401 });
    }

    const res = NextResponse.json({ success: true });
    res.cookies.set(AUTH_COOKIE_NAME, appToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 14,
    });
    return res;
  } catch {
    return NextResponse.json({ error: "Login failed" }, { status: 500 });
  }
}
