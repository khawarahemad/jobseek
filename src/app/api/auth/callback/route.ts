import { NextResponse } from "next/server";

/**
 * Legacy OAuth callback forwarder.
 * Consolidates OAuth flow into the single canonical NextAuth callback (/api/auth/callback/google).
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.AUTH_URL || "https://jobseek.khawarahemad.com";

  const target = new URL(`${appUrl}/api/auth/callback/google`);
  url.searchParams.forEach((value, key) => {
    target.searchParams.set(key, value);
  });

  return NextResponse.redirect(target.toString());
}

