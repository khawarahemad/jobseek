import { google } from "googleapis";
import nodemailer from "nodemailer";
import { prisma } from "@/lib/prisma";
import { downloadResumeFromS3, getResumeS3Key } from "@/lib/s3";

export interface SendEmailParams {
  userId: string;
  jobId: string;
  to: string;
  subject: string;
  body: string;
  attachResume?: boolean;
}

export interface SendEmailResult {
  success: boolean;
  messageId?: string;
  threadId?: string;
  error?: string;
  providerUsed?: "gmail_api" | "gmail_smtp";
}

// ─── Resume attachment helper ─────────────────────────────────────────────────
/**
 * Tries to load the resume buffer from:
 *  1. S3 bucket (preferred: resumes/<userId>/resume.pdf stored at upload time)
 *  2. DB CandidateProfile.resumeS3Key override
 *  3. LOCAL_RESUME_PATH env var as final fallback
 */
async function resolveResumeAttachment(
  userId: string
): Promise<{ buffer: Buffer; filename: string } | null> {
  // 1. Try S3 lookup by convention key
  try {
    const s3Key = await getResumeS3Key(userId);
    if (s3Key) {
      // Check if profile has a custom filename
      const profile = await prisma.candidateProfile.findUnique({
        where: { userId },
        select: { resumeFilename: true, resumeS3Key: true },
      });

      const keyToUse = profile?.resumeS3Key || s3Key;
      const buffer = await downloadResumeFromS3(keyToUse);
      const filename = profile?.resumeFilename || "resume.pdf";
      console.log(`[Resume] Loaded from S3: ${keyToUse}`);
      return { buffer, filename };
    }
  } catch (s3Err) {
    console.warn("[Resume] S3 fetch failed:", s3Err);
  }

  return null;
}

// ─── Main dispatcher ──────────────────────────────────────────────────────────
/**
 * Dispatches an email via Google Gmail API or direct Gmail SMTP fallback.
 * Always attaches the resume PDF if available (from S3 or local).
 */
export async function sendEmailViaGmail(params: SendEmailParams): Promise<SendEmailResult> {
  const { userId, jobId, to, subject, body, attachResume = true } = params;

  // Resolve resume once for this dispatch
  let resumeAttachment: { buffer: Buffer; filename: string } | null = null;
  if (attachResume) {
    resumeAttachment = await resolveResumeAttachment(userId);
  }

  // 1. Check for connected Google OAuth account
  let refreshToken: string | null | undefined = null;
  const googleAccount = await prisma.account.findFirst({
    where: { userId, provider: "google" },
  });

  if (googleAccount?.refresh_token) {
    refreshToken = googleAccount.refresh_token;
  } else if (process.env.GOOGLE_REFRESH_TOKEN) {
    refreshToken = process.env.GOOGLE_REFRESH_TOKEN;
  }

  // Option A: Send via Google OAuth API
  if (refreshToken && process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    try {
      const oauth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        "http://localhost:3000/api/auth/callback"
      );

      oauth2Client.setCredentials({ refresh_token: refreshToken });
      const gmail = google.gmail({ version: "v1", auth: oauth2Client });

      // Compose RFC 2822 MIME message using nodemailer MailComposer
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const MailComposer = ((await import("nodemailer/lib/mail-composer")) as any).default;
      const composer = new MailComposer({
        to,
        subject,
        text: body,
        attachments: resumeAttachment
          ? [
              {
                filename: resumeAttachment.filename,
                content: resumeAttachment.buffer,
                contentType: "application/pdf",
              },
            ]
          : undefined,
      });

      const rawBuffer = await new Promise<Buffer>((resolve, reject) => {
        composer.compile().build((err: any, msg: Buffer) => {
          if (err) reject(err);
          else resolve(msg);
        });
      });

      const encodedMessage = rawBuffer
        .toString("base64")
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");

      const res = await gmail.users.messages.send({
        userId: "me",
        requestBody: { raw: encodedMessage },
      });

      const messageId = res.data.id || undefined;
      const threadId = res.data.threadId || undefined;

      await logSentOutreach(jobId, to, subject, body, messageId, threadId);

      return {
        success: true,
        messageId,
        threadId,
        providerUsed: "gmail_api",
      };
    } catch (err: unknown) {
      console.warn("[Gmail Sender] OAuth dispatch failed, trying SMTP fallback:", (err as Error).message);
    }
  }

  // Option B: Gmail SMTP via App Password
  const gmailUser = process.env.GMAIL_USER || "ahemadkhawar123@gmail.com";
  const gmailAppPass = (process.env.GMAIL_APP_PASSWORD || "").replace(/\s+/g, "");

  if (gmailAppPass) {
    try {
      const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
          user: gmailUser,
          pass: gmailAppPass,
        },
      });

      const attachments: Array<{ filename: string; content: Buffer; contentType: string }> = [];
      if (resumeAttachment) {
        attachments.push({
          filename: resumeAttachment.filename,
          content: resumeAttachment.buffer,
          contentType: "application/pdf",
        });
      }

      const info = await transporter.sendMail({
        from: `Khawar Ahemad Khan <${gmailUser}>`,
        to,
        subject,
        text: body,
        attachments,
      });

      await logSentOutreach(jobId, to, subject, body, info.messageId, undefined);

      return {
        success: true,
        messageId: info.messageId,
        providerUsed: "gmail_smtp",
      };
    } catch (err: unknown) {
      console.error("[Gmail Sender] SMTP Error:", err);
      return {
        success: false,
        error: (err as Error).message || "Failed to dispatch email via Gmail SMTP",
      };
    }
  }

  return {
    success: false,
    error: "No email dispatch method configured. Connect Gmail OAuth or set GMAIL_APP_PASSWORD.",
  };
}

async function logSentOutreach(
  jobId: string,
  to: string,
  subject: string,
  body: string,
  messageId?: string,
  threadId?: string
) {
  await prisma.$transaction([
    prisma.outreachLog.create({
      data: {
        jobId,
        threadId,
        messageId,
        sentTo: to,
        subject,
        bodySnippet: body.slice(0, 300),
      },
    }),
    prisma.job.update({
      where: { id: jobId },
      data: {
        status: "EMAILED",
        generatedSubject: subject,
        generatedBody: body,
      },
    }),
  ]);
}
