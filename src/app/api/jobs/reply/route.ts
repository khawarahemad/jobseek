import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma, withDbRetry } from "@/lib/prisma";
import { generateAiReply } from "@/lib/ai/reply-copilot";
import { sendEmailViaGmail } from "@/lib/gmail/sender";

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { action, jobId, toEmail, subject, replyBody } = body;

    if (!jobId) {
      return NextResponse.json({ error: "Missing jobId" }, { status: 400 });
    }

    const job = await withDbRetry(() =>
      prisma.job.findUnique({
        where: { id: jobId },
      })
    );

    if (!job || job.userId !== session.user.id) {
      return NextResponse.json({ error: "Job lead not found" }, { status: 404 });
    }

    // ACTION 1: Generate or refresh AI reply suggestion
    if (action === "suggest") {
      const candidateName = session.user.name || "Khawar Ahemad Khan";
      const recruiterMsg =
        job.lastReplySnippet ||
        "Thank you for reaching out. We reviewed your profile and would love to arrange a short introductory conversation. Could you let us know your availability?";

      const aiReply = await generateAiReply({
        candidateName,
        company: job.company,
        role: job.title,
        recruiterMessage: recruiterMsg,
        recruiterFrom: job.lastReplyFrom || job.hrEmail,
        customContext: job.customContext,
      });

      // Update the database with the AI suggested reply
      await withDbRetry(() =>
        prisma.job.update({
          where: { id: jobId },
          data: {
            suggestedAiReply: aiReply.suggestedBody,
          },
        })
      );

      return NextResponse.json({
        success: true,
        aiReply,
      });
    }

    // ACTION 2: Send the reply back to the recruiter
    if (action === "send") {
      const targetEmail = toEmail || job.lastReplyFrom || job.hrEmail;
      if (!targetEmail) {
        return NextResponse.json({ error: "No recipient email to send reply to" }, { status: 400 });
      }
      if (!replyBody) {
        return NextResponse.json({ error: "Reply body cannot be empty" }, { status: 400 });
      }

      const replySubject = subject || `Re: ${job.title} – ${session.user.name || "Khawar Ahemad Khan"}`;

      const sendResult = await sendEmailViaGmail({
        userId: session.user.id,
        jobId,
        to: targetEmail,
        subject: replySubject,
        body: replyBody,
        attachResume: false, // Resume is already with them
      });

      if (!sendResult.success) {
        return NextResponse.json({ error: sendResult.error || "Failed to send email" }, { status: 500 });
      }

      // Upgrade status to INTERVIEWING if they are scheduling
      await withDbRetry(() =>
        prisma.job.update({
          where: { id: jobId },
          data: {
            status: "INTERVIEWING",
          },
        })
      );

      return NextResponse.json({
        success: true,
        messageId: sendResult.messageId,
        newStatus: "INTERVIEWING",
      });
    }

    return NextResponse.json({ error: "Invalid action specified" }, { status: 400 });
  } catch (err: unknown) {
    console.error("[API /api/jobs/reply] Error:", err);
    return NextResponse.json(
      { error: (err as Error).message || "Internal server error" },
      { status: 500 }
    );
  }
}
