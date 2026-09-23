import { google } from "googleapis";
import { prisma, withDbRetry } from "@/lib/prisma";

export interface MonitorScanResult {
  success: boolean;
  bouncesDetected: number;
  repliesDetected: number;
  bouncedEmails: string[];
  repliedJobs: string[];
  error?: string;
}

/**
 * Scans user's Gmail mailbox for recruiter replies and delivery failure bounces
 */
export async function scanGmailForRepliesAndBounces(userId: string): Promise<MonitorScanResult> {
  // 1. Fetch user's Google OAuth refresh token with DB retry
  let refreshToken: string | null = null;
  try {
    const googleAccount = await withDbRetry(() =>
      prisma.account.findFirst({
        where: { userId, provider: "google" },
      })
    );

    refreshToken =
      googleAccount?.refresh_token ||
      (process.env.GOOGLE_REFRESH_TOKEN && process.env.GOOGLE_REFRESH_TOKEN.length > 20
        ? process.env.GOOGLE_REFRESH_TOKEN
        : null);
  } catch (err: unknown) {
    console.warn("[Monitor] DB connection notice during account check:", (err as Error).message);
    return {
      success: false,
      bouncesDetected: 0,
      repliesDetected: 0,
      bouncedEmails: [],
      repliedJobs: [],
      error: "Database is reconnecting. Please retry in a few moments.",
    };
  }

  if (!refreshToken) {
    return {
      success: false,
      bouncesDetected: 0,
      repliesDetected: 0,
      bouncedEmails: [],
      repliedJobs: [],
      error: "No Google account connected. Please sign in with Google or connect Gmail in Settings to enable live inbox sync.",
    };
  }


  try {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://jobseek.khawarahemad.com";
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      `${appUrl}/api/auth/callback`
    );
    oauth2Client.setCredentials({ refresh_token: refreshToken });

    const gmail = google.gmail({ version: "v1", auth: oauth2Client });

    // Fetch user's own email profile to distinguish replies
    const profileRes = await gmail.users.getProfile({ userId: "me" });
    const userGmailAddress = profileRes.data.emailAddress?.toLowerCase() || "";

    const bouncedEmails: Set<string> = new Set();
    const repliedJobIds: Set<string> = new Set();

    // 2. Scan for Bounces (Mailer-Daemon)
    try {
      const bounceSearch = await gmail.users.messages.list({
        userId: "me",
        q: 'from:mailer-daemon OR subject:"Delivery Status Notification"',
        maxResults: 15,
      });

      const bounceMessages = bounceSearch.data.messages || [];

      for (const msgSummary of bounceMessages) {
        if (!msgSummary.id) continue;
        const msg = await gmail.users.messages.get({
          userId: "me",
          id: msgSummary.id,
          format: "full",
        });

        // Search message snippet and body for failed recipient
        const snippet = msg.data.snippet || "";
        const patterns = [
          /Your message wasn't delivered to ([\w.-]+@[\w.-]+)/i,
          /Failed to deliver to '([\w.-]+@[\w.-]+)'/i,
          /Delivery to the following recipient failed permanently:\s*([\w.-]+@[\w.-]+)/i,
          /550[\s\S]*?([\w.-]+@[\w.-]+)/i,
          /Address not found[\s\S]*?([\w.-]+@[\w.-]+)/i,
        ];

        for (const p of patterns) {
          const match = snippet.match(p);
          if (match && match[1]) {
            bouncedEmails.add(match[1].toLowerCase());
          }
        }
      }
    } catch (err: unknown) {
      console.warn("[Monitor] Bounce scan notice:", (err as Error).message);
    }

    // 3. Mark matching jobs as BOUNCED
    if (bouncedEmails.size > 0) {
      const emailList = Array.from(bouncedEmails);
      const jobsToBounce = await withDbRetry(() =>
        prisma.job.findMany({
          where: {
            userId,
            status: "EMAILED",
            hrEmail: { in: emailList, mode: "insensitive" },
          },
        })
      );

      for (const j of jobsToBounce) {
        await withDbRetry(() =>
          prisma.job.update({
            where: { id: j.id },
            data: {
              status: "BOUNCED",
              bouncedAt: new Date(),
            },
          })
        );
      }
    }

    // 4. Scan active threads for Recruiter Replies
    const activeEmailedJobs = await withDbRetry(() =>
      prisma.job.findMany({
        where: {
          userId,
          status: "EMAILED",
        },
        include: {
          outreachLogs: {
            where: { threadId: { not: null } },
            orderBy: { sentAt: "desc" },
            take: 1,
          },
        },
      })
    );

    for (const job of activeEmailedJobs) {
      const threadId = job.outreachLogs[0]?.threadId;
      if (!threadId) continue;

      try {
        const thread = await gmail.users.threads.get({
          userId: "me",
          id: threadId,
        });

        const messages = thread.data.messages || [];
        if (messages.length > 1) {
          // Check if any message is NOT from the user
          for (const msg of messages) {
            const headers = msg.payload?.headers || [];
            const fromHeader = headers.find((h) => h.name?.toLowerCase() === "from")?.value || "";
            if (fromHeader && !fromHeader.toLowerCase().includes(userGmailAddress)) {
              // Recruiter replied!
              repliedJobIds.add(job.id);
              break;
            }
          }
        }
      } catch {
        // ignore individual thread query errors
      }
    }

    // Advance replied jobs to REPLIED
    for (const jid of Array.from(repliedJobIds)) {
      await withDbRetry(() =>
        prisma.job.update({
          where: { id: jid },
          data: { status: "REPLIED" },
        })
      );
    }


    return {
      success: true,
      bouncesDetected: bouncedEmails.size,
      repliesDetected: repliedJobIds.size,
      bouncedEmails: Array.from(bouncedEmails),
      repliedJobs: Array.from(repliedJobIds),
    };
  } catch (err: unknown) {
    console.error("[Monitor] Error scanning Gmail:", err);
    return {
      success: false,
      bouncesDetected: 0,
      repliesDetected: 0,
      bouncedEmails: [],
      repliedJobs: [],
      error: (err as Error).message,
    };
  }
}
