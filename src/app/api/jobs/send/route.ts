import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendEmailViaGmail } from "@/lib/gmail/sender";
import { invalidateMailboxCleanCache } from "@/lib/gmail/reconciler";

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { jobId, subject, emailBody, toEmail, toEmails, attachResume = true } = body;

    if (!jobId || !subject || !emailBody) {
      return NextResponse.json(
        { error: "Missing required fields (jobId, subject, emailBody)" },
        { status: 400 }
      );
    }

    const job = await prisma.job.findUnique({
      where: { id: jobId },
    });

    if (!job || job.userId !== session.user.id) {
      return NextResponse.json({ error: "Job lead not found" }, { status: 404 });
    }

    // Determine all recipients to send to
    let recipients: string[] = [];
    if (Array.isArray(toEmails) && toEmails.length > 0) {
      recipients = toEmails.map((e) => String(e).trim()).filter(Boolean);
    } else if (toEmail) {
      recipients = [toEmail.trim()];
    } else if (job.hrEmail) {
      recipients = [job.hrEmail.trim()];
    }

    if (recipients.length === 0) {
      return NextResponse.json(
        { error: "No recipient email addresses specified for this job lead" },
        { status: 400 }
      );
    }

    // Dispatch to ALL specified HR recipients
    const breakdown = [];
    let successfulCount = 0;

    for (const recipient of recipients) {
      try {
        const result = await sendEmailViaGmail({
          userId: session.user.id,
          jobId,
          to: recipient,
          subject,
          body: emailBody,
          attachResume,
        });

        if (result.success) {
          successfulCount++;
        }

        breakdown.push({
          email: recipient,
          success: result.success,
          messageId: result.messageId,
          error: result.error,
          provider: result.providerUsed,
        });
      } catch (sendErr: unknown) {
        breakdown.push({
          email: recipient,
          success: false,
          error: (sendErr as Error).message,
        });
      }
    }

    if (successfulCount === 0) {
      return NextResponse.json(
        { error: breakdown[0]?.error || "Failed to dispatch emails", breakdown },
        { status: 400 }
      );
    }

    // Next sync will verify if any bounces occur from this newly dispatched batch
    invalidateMailboxCleanCache();

    return NextResponse.json({
      success: true,
      dispatchedCount: successfulCount,
      totalRequested: recipients.length,
      breakdown,
    });

  } catch (err: unknown) {
    console.error("[API /api/jobs/send] Error:", err);
    return NextResponse.json(
      { error: (err as Error).message || "Internal server error" },
      { status: 500 }
    );
  }
}
