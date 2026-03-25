import { NextRequest } from "next/server";

export const AUTH_COOKIE_NAME = "pm_auth";

export function isAuthenticatedRequest(req: NextRequest): boolean {
  const expectedToken = process.env.APP_AUTH_TOKEN;
  if (!expectedToken) return false;
  const token = req.cookies.get(AUTH_COOKIE_NAME)?.value;
  return Boolean(token && token === expectedToken);
}
