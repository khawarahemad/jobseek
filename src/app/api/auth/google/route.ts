import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.redirect("http://localhost:3000/api/auth/signin/google?callbackUrl=/dashboard/settings");
}
