import { handlers } from "@/lib/auth";
import { NextRequest } from "next/server";

function fixRequest(req: NextRequest): NextRequest {
  const publicUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.AUTH_URL || "https://jobseek.khawarahemad.com";
  try {
    const urlObj = new URL(publicUrl);
    const newHeaders = new Headers(req.headers);
    newHeaders.set("x-forwarded-host", urlObj.host);
    newHeaders.set("x-forwarded-proto", urlObj.protocol.replace(":", ""));
    newHeaders.set("host", urlObj.host);

    const newUrl = new URL(req.url);
    newUrl.protocol = urlObj.protocol;
    newUrl.host = urlObj.host;
    newUrl.port = urlObj.port;

    return new NextRequest(newUrl.toString(), {
      method: req.method,
      headers: newHeaders,
      body: req.body,
    });
  } catch {
    return req;
  }
}

export async function GET(req: NextRequest) {
  try {
    const fixed = fixRequest(req);
    return await handlers.GET(fixed);
  } catch (err) {
    console.error("[NextAuth GET Handler Exception]:", err);
    throw err;
  }
}

export async function POST(req: NextRequest) {
  try {
    const fixed = fixRequest(req);
    return await handlers.POST(fixed);
  } catch (err) {
    console.error("[NextAuth POST Handler Exception]:", err);
    throw err;
  }
}


