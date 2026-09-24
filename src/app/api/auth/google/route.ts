import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://jobseek.khawarahemad.com";
  return NextResponse.redirect(`${appUrl}/api/auth/signin/google?callbackUrl=/dashboard/settings`);
}
