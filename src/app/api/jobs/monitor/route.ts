import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { reconcilePipelineWithMail, isMailboxMarkedClean } from "@/lib/gmail/reconciler";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const force = url.searchParams.get("force") === "true";
  return handleMonitorScan(force);
}

export async function POST(request: Request) {
  let force = false;
  try {
    const body = await request.json().catch(() => ({}));
    force = Boolean(body?.force);
  } catch {
    force = false;
  }
  return handleMonitorScan(force);
}

async function handleMonitorScan(force = false) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const result = await reconcilePipelineWithMail(session.user.id, force);
    return NextResponse.json(result);

  } catch (err: unknown) {
    console.warn("[API /api/jobs/monitor] Sync notice:", (err as Error).message);
    return NextResponse.json({
      success: false,
      bouncesDetected: [],
      repliesDetected: [],
      fixedCount: 0,
      fixedJobs: [],
      isMailboxClean: isMailboxMarkedClean(),
      error: "Gmail sync is reconnecting. Please try again shortly.",
    });
  }
}
