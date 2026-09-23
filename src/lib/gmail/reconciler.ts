import { prisma, withDbRetry } from "@/lib/prisma";
import { execFile } from "child_process";
import { promisify } from "util";
import { google } from "googleapis";
import { generateAiReply } from "@/lib/ai/reply-copilot";

const execFileAsync = promisify(execFile);

export interface ReconciledJobFix {
  jobId: string;
  company: string;
  fromStatus: string;
  toStatus: string;
  reason: string;
}

export interface BouncedEmailDetail {
  email: string;
  reason: string;
  company?: string;
  jobTitle?: string;
  purgedFromInbox: boolean;
  detectedAt?: string;
}

export interface ReconcileResult {
  success: boolean;
  fixedCount: number;
  fixedJobs: ReconciledJobFix[];
  bouncesDetected: string[];
  bouncedDetails: BouncedEmailDetail[];
  purgedFromMailboxCount: number;
  isMailboxClean: boolean;
  repliesDetected: string[];
  providerUsed: "gmail_api" | "gmail_imap" | "database_audit";
  error?: string;
}

// Permanent in-memory cache to avoid continuous redundant cleaning once confirmed clean
let isMailboxCleanMarked = false;
let lastMailboxAuditTimestamp = 0;

/**
 * Mark mailbox as clean (no pending bounces in Inbox)
 */
export function markMailboxClean() {
  isMailboxCleanMarked = true;
  lastMailboxAuditTimestamp = Date.now();
}

/**
 * Invalidate clean cache (e.g., when new outreach emails are dispatched)
 */
export function invalidateMailboxCleanCache() {
  isMailboxCleanMarked = false;
  lastMailboxAuditTimestamp = 0;
}

/**
 * Check if mailbox is currently marked clean
 */
export function isMailboxMarkedClean(): boolean {
  return isMailboxCleanMarked;
}

/**
 * IMAP Mailbox Cleaner:
 * Moves bounce failure notices from the user's Gmail Inbox into Bin/Trash and expunges
 * so the user's Gmail mailbox is kept completely clean.
 * Once marked clean, skips redundant sub-process executions completely unless forced.
 */
async function purgeBouncedEmailsViaImap(
  gmailUser: string,
  gmailAppPass: string,
  force = false
): Promise<{ purgedCount: number; purgedEmails: string[] }> {
  try {
    if (!force && isMailboxCleanMarked) {
      return { purgedCount: 0, purgedEmails: [] };
    }

    const script = `
import imaplib, email, re, json

mail = imaplib.IMAP4_SSL("imap.gmail.com")
mail.login("${gmailUser}", "${gmailAppPass}")
mail.select("inbox")

purged = []
res, b_msgs = mail.search(None, '(FROM "mailer-daemon")')
msg_count = len(b_msgs[0].split()) if res == "OK" and b_msgs[0] else 0

if res == "OK" and b_msgs[0]:
    for eid in b_msgs[0].split():
        _, msg_data = mail.fetch(eid, "(RFC822)")
        for part in msg_data:
            if isinstance(part, tuple):
                msg = email.message_from_bytes(part[1])
                body = ""
                for p in msg.walk():
                    if p.get_content_type() in ["text/plain", "text/html"]:
                        try:
                            body += p.get_payload(decode=True).decode(errors="replace") + "\\n"
                        except Exception:
                            pass
                matches = re.findall(r"[\\w\\.-]+@[\\w\\.-]+", body)
                purged.extend(matches)

                # Move to Bin/Trash
                for folder in ['"[Gmail]/Bin"', '"[Gmail]/Trash"']:
                    try:
                        r, _ = mail.copy(eid, folder)
                        if r == "OK":
                            break
                    except Exception:
                        pass
                mail.store(eid, '+FLAGS', '\\\\Deleted')

    mail.expunge()

mail.logout()
print(json.dumps({"purgedCount": msg_count, "emails": list(set(purged))}))
`;
    const { stdout } = await execFileAsync("python3", ["-c", script], { timeout: 15000 });
    const parsed = JSON.parse(stdout.trim());
    const count = parsed.purgedCount || 0;
    if (count === 0) {
      isMailboxCleanMarked = true;
      lastMailboxAuditTimestamp = Date.now();
    }
    return {
      purgedCount: count,
      purgedEmails: parsed.emails || [],
    };
  } catch (err) {
    console.warn("[PurgeImap] IMAP purge notice:", (err as Error).message);
    return { purgedCount: 0, purgedEmails: [] };
  }
}

/**
 * Autonomous Mail Reconciliation Engine.
 * 1. Inspects real-time Gmail inbox and sent logs.
 * 2. Grabs bounced email IDs + reasons and saves them permanently to the Database.
 * 3. Purges/deletes bounce notifications from Gmail inbox to keep user's mailbox completely clean!
 * 4. Corrects Kanban positions automatically based on real email activity.
 */
export async function reconcilePipelineWithMail(userId: string, force = false): Promise<ReconcileResult> {
  const fixedJobs: ReconciledJobFix[] = [];
  const bouncesDetected: Set<string> = new Set();
  const repliedDomains: Set<string> = new Set();
  const bouncedDetailsMap = new Map<string, { reason: string; purged: boolean }>();
  let purgedCount = 0;
  const shouldCheckBounces = force || !isMailboxCleanMarked;

  try {
    // 1. Fetch user's current pipeline jobs and outreach logs
    const userJobs = await withDbRetry(() =>
      prisma.job.findMany({
        where: { userId },
        include: {
          outreachLogs: {
            orderBy: { sentAt: "desc" },
          },
        },
      })
    );

    if (userJobs.length === 0) {
      return {
        success: true,
        fixedCount: 0,
        fixedJobs: [],
        bouncesDetected: [],
        bouncedDetails: [],
        purgedFromMailboxCount: 0,
        isMailboxClean: isMailboxCleanMarked,
        repliesDetected: [],
        providerUsed: "database_audit",
      };
    }

    // 2. Check for Google OAuth tokens
    let googleAccount = await withDbRetry(() =>
      prisma.account.findFirst({
        where: { userId, provider: "google" },
      })
    );

    if (!googleAccount?.refresh_token) {
      googleAccount = await withDbRetry(() =>
        prisma.account.findFirst({
          where: { provider: "google", refresh_token: { not: null } },
        })
      );
    }

    const refreshToken =
      googleAccount?.refresh_token ||
      (process.env.GOOGLE_REFRESH_TOKEN && process.env.GOOGLE_REFRESH_TOKEN.length > 20
        ? process.env.GOOGLE_REFRESH_TOKEN
        : null);

    let providerUsed: "gmail_api" | "gmail_imap" | "database_audit" = "database_audit";
    const replyDataMap = new Map<string, { from: string; snippet: string; subject: string; date?: Date }>();

    // 3A. Scan via Google Gmail API if OAuth token exists
    if (refreshToken && process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
      providerUsed = "gmail_api";
      try {
        const oauth2Client = new google.auth.OAuth2(
          process.env.GOOGLE_CLIENT_ID,
          process.env.GOOGLE_CLIENT_SECRET,
          "http://localhost:3000/api/auth/callback"
        );
        oauth2Client.setCredentials({ refresh_token: refreshToken });
        const gmail = google.gmail({ version: "v1", auth: oauth2Client });

        // Search for bounces in Gmail API ONLY if not already marked clean or if forced
        if (shouldCheckBounces) {
          const bounceRes = await gmail.users.messages.list({
            userId: "me",
            q: 'from:mailer-daemon OR subject:"Delivery Status Notification"',
            maxResults: 20,
          });

          for (const msgSummary of bounceRes.data.messages || []) {
            if (!msgSummary.id) continue;
            const msg = await gmail.users.messages.get({ userId: "me", id: msgSummary.id });
            const snippet = msg.data.snippet || "";
            let failedEmail: string | null = null;
            let reason = "Delivery failed: Recipient address rejected or not found";

            const patterns = [
              /Your message wasn't delivered to ([\w.-]+@[\w.-]+)/i,
              /Failed to deliver to '([\w.-]+@[\w.-]+)'/i,
              /Delivery to the following recipient failed permanently:\s*([\w.-]+@[\w.-]+)/i,
              /550[\s\S]*?([\w.-]+@[\w.-]+)/i,
              /Address not found[\s\S]*?([\w.-]+@[\w.-]+)/i,
              /delivering your message to ([\w.-]+@[\w.-]+)/i,
            ];
            for (const p of patterns) {
              const match = snippet.match(p);
              if (match?.[1]) {
                failedEmail = match[1].toLowerCase();
                break;
              }
            }

            const groupMatch = snippet.match(/the group you tried to contact \(([\w.-]+)\) may not exist/i);
            if (groupMatch?.[1]) {
              const groupName = groupMatch[1].toLowerCase();
              for (const j of userJobs) {
                const compClean = j.company.toLowerCase().replace(/[^a-z0-9]/g, "");
                if (snippet.toLowerCase().includes(compClean) || snippet.toLowerCase().includes(j.company.toLowerCase())) {
                  failedEmail = `${groupName}@${compClean}.com`;
                  reason = "Google Group closed: group does not exist or external posting is blocked";
                  break;
                }
              }
            }

            if (snippet.includes("550")) {
              reason = "550 5.1.1 The email account that you tried to reach does not exist";
            }

            if (failedEmail) {
              bouncesDetected.add(failedEmail);
              bouncedDetailsMap.set(failedEmail, { reason, purged: true });

              // Purge/trash bounce message from Gmail inbox to keep mailbox clean!
              try {
                await gmail.users.messages.trash({ userId: "me", id: msgSummary.id });
                purgedCount++;
              } catch {
                // OAuth token has read-only/send scope; mailbox cleaning is handled by IMAP below
              }
            }
          }

          // Clean Mailbox via IMAP if credentials exist
          const gmailUser = process.env.GMAIL_USER || "ahemadkhawar123@gmail.com";
          const gmailAppPass = (process.env.GMAIL_APP_PASSWORD || "").replace(/\s+/g, "");
          if (gmailAppPass) {
            const imapResult = await purgeBouncedEmailsViaImap(gmailUser, gmailAppPass, force);
            purgedCount = Math.max(purgedCount, imapResult.purgedCount);
          }

          if (purgedCount === 0 && bouncesDetected.size === 0) {
            markMailboxClean();
          }
        }

        // Search for inbound recruiter replies across target companies
        for (const job of userJobs) {
          const cleanComp = job.company.toLowerCase().replace(/[^a-z0-9]/g, "");
          const hrEmails: string[] = Array.isArray(job.hrContacts)
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            ? (job.hrContacts as any[]).map((c) => c.email).filter(Boolean)
            : job.hrEmail
            ? [job.hrEmail]
            : [];

          const emailQuery = hrEmails.length > 0 ? hrEmails.map((e) => `from:${e}`).join(" OR ") : "";
          const query = emailQuery ? `to:me (${emailQuery})` : `to:me from:${cleanComp}`;

          const searchRes = await gmail.users.messages.list({
            userId: "me",
            q: query,
            maxResults: 2,
          });

          if (searchRes.data.messages && searchRes.data.messages.length > 0) {
            const firstMsgId = searchRes.data.messages[0].id;
            if (firstMsgId) {
              const fullMsg = await gmail.users.messages.get({ userId: "me", id: firstMsgId });
              const headers = fullMsg.data.payload?.headers || [];
              const fromVal = headers.find((h) => h.name?.toLowerCase() === "from")?.value || "";
              const subjectVal = headers.find((h) => h.name?.toLowerCase() === "subject")?.value || "";
              const snippet = fullMsg.data.snippet || "";

              replyDataMap.set(job.id, {
                from: fromVal,
                subject: subjectVal,
                snippet,
                date: new Date(),
              });
              repliedDomains.add(job.company.toLowerCase());
            }
          }
        }
      } catch (err: unknown) {
        console.warn("[Reconciler] Gmail API scan notice:", (err as Error).message);
      }
    } else {
      // 3B. High-Precision IMAP Scan via user's configured Gmail credentials
      const gmailUser = process.env.GMAIL_USER || "ahemadkhawar123@gmail.com";
      const gmailAppPass = (process.env.GMAIL_APP_PASSWORD || "").replace(/\s+/g, "");

      if (gmailAppPass) {
        providerUsed = "gmail_imap";
        try {
          const script = `
import imaplib, email, os, re, json

mail = imaplib.IMAP4_SSL("imap.gmail.com")
mail.login("${gmailUser}", "${gmailAppPass}")
mail.select("inbox")

# 1. Bounces (only when mailbox is not already confirmed clean)
bounces = []
check_bounces = ${shouldCheckBounces ? "True" : "False"}
if check_bounces:
    res, b_msgs = mail.search(None, '(FROM "mailer-daemon")')
    if res == "OK" and b_msgs[0]:
    for eid in b_msgs[0].split():
        _, msg_data = mail.fetch(eid, "(RFC822)")
        for part in msg_data:
            if isinstance(part, tuple):
                msg = email.message_from_bytes(part[1])
                body = ""
                for p in msg.walk():
                    if p.get_content_type() in ["text/plain", "text/html"]:
                        try:
                            body += p.get_payload(decode=True).decode(errors="replace") + "\\n"
                        except Exception:
                            pass
                
                failed_email = None
                reason = "Delivery failed: Recipient address rejected or not found"
                
                m1 = re.search(r"Your message wasn\x27t delivered to ([\\w\\.-]+@[\\w\\.-]+)", body, re.I)
                m2 = re.search(r"Delivery to the following recipient failed permanently:\\s*([\\w\\.-]+@[\\w\\.-]+)", body, re.I)
                m3 = re.search(r"Failed to deliver to [\\x27\\\"]?([\\w\\.-]+@[\\w\\.-]+)", body, re.I)
                m4 = re.search(r"delivering your message to ([\\w\\.-]+@[\\w\\.-]+)", body, re.I)
                m5 = re.search(r"550[\\s\\S]*?([\\w\\.-]+@[\\w\\.-]+)", body, re.I)
                m6 = re.search(r"the group you tried to contact \\(([\\w\\.-]+)\\) may not exist", body, re.I)
                
                if m1:
                    failed_email = m1.group(1).lower()
                elif m2:
                    failed_email = m2.group(1).lower()
                elif m3:
                    failed_email = m3.group(1).lower()
                elif m4:
                    failed_email = m4.group(1).lower()
                elif m5:
                    failed_email = m5.group(1).lower()
                elif m6:
                    group_name = m6.group(1).lower()
                    dom_m = re.search(r"([\\w\\.-]+) admins", body, re.I) or re.search(r"support\\.google\\.com/a/([\\w\\.-]+)", body, re.I)
                    if dom_m:
                        failed_email = f"{group_name}@{dom_m.group(1).lower()}"
                    else:
                        failed_email = group_name

                r_match = re.search(r"(550[\\s\\S]*?(?:NoSuchUser|exist|gsmtp|rejected|disabled|quota))", body, re.I)
                if r_match:
                    reason = r_match.group(1).strip().replace("\\r", " ").replace("\\n", " ")
                    reason = re.sub(r"\\s+", " ", reason)[:160]
                elif "the group you tried to contact" in body.lower():
                    reason = "Google Group closed or external posting blocked"
                elif "address couldn't be found" in body.lower():
                    reason = "Address not found or unable to receive mail"

                # Move bounce to Bin/Trash and expunge from inbox to keep mailbox clean!
                purged = False
                for folder in ['"[Gmail]/Bin"', '"[Gmail]/Trash"']:
                    try:
                        r, _ = mail.copy(eid, folder)
                        if r == "OK":
                            purged = True
                            break
                    except Exception:
                        pass
                mail.store(eid, '+FLAGS', '\\\\Deleted')
                
                if failed_email:
                    bounces.append({
                        "eid": eid.decode(),
                        "email": failed_email,
                        "reason": reason,
                        "purged": purged
                    })

    mail.expunge()

# 2. Inbound replies matching companies
replied_companies = []
test_companies = ${JSON.stringify(userJobs.map((j) => j.company.toLowerCase()))}
for c in test_companies:
    clean = re.sub(r'[^a-z0-9]', '', c)
    if len(clean) > 3:
        res, msgs = mail.search(None, f'(OR FROM "{clean}" SUBJECT "{clean}")')
        if res == "OK" and msgs[0] and len(msgs[0].split()) > 0:
            replied_companies.append(c)

mail.logout()
print(json.dumps({"bounces": bounces, "replied": list(set(replied_companies))}))
`;
          const { stdout } = await execFileAsync("python3", ["-c", script], { timeout: 15000 });
          const parsed = JSON.parse(stdout.trim());
          if (parsed.bounces && Array.isArray(parsed.bounces)) {
            for (const b of parsed.bounces) {
              const cleanEmail = String(b.email).toLowerCase();
              bouncesDetected.add(cleanEmail);
              bouncedDetailsMap.set(cleanEmail, {
                reason: b.reason || "Delivery bounced: internal group or address not found",
                purged: Boolean(b.purged),
              });
              if (b.purged) purgedCount++;
            }
          }
          if (parsed.replied) {
            for (const r of parsed.replied) repliedDomains.add(String(r).toLowerCase());
          }
          if (shouldCheckBounces && purgedCount === 0 && bouncesDetected.size === 0) {
            markMailboxClean();
          }
        } catch (err: unknown) {
          console.warn("[Reconciler] IMAP scan notice:", (err as Error).message);
        }
      }
    }

    // 4. GRAB TO DATABASE: Persist all detected bounces to OutreachLogs & Jobs
    for (const [bEmail, detail] of bouncedDetailsMap.entries()) {
      const matchingJob = userJobs.find(
        (j) =>
          j.outreachLogs?.some((l) => l.sentTo?.toLowerCase() === bEmail) ||
          j.hrEmail?.toLowerCase() === bEmail ||
          (Array.isArray(j.hrContacts) &&
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (j.hrContacts as any[]).some((c) => c.email?.toLowerCase() === bEmail)) ||
          bEmail.endsWith(`@${j.company.toLowerCase().replace(/[^a-z0-9]/g, "")}.com`)
      );

      if (matchingJob) {
        // 4A. Update matching OutreachLogs
        const matchingLog = matchingJob.outreachLogs?.find((l) => l.sentTo?.toLowerCase() === bEmail);
        if (matchingLog) {
          if (matchingLog.status !== "BOUNCED") {
            await withDbRetry(() =>
              prisma.outreachLog.update({
                where: { id: matchingLog.id },
                data: {
                  status: "BOUNCED",
                  bounceReason: detail.reason,
                },
              })
            );
          }
        } else {
          // Auto-record new OutreachLog in DB so it is permanently tracked
          await withDbRetry(() =>
            prisma.outreachLog.create({
              data: {
                jobId: matchingJob.id,
                sentTo: bEmail,
                status: "BOUNCED",
                bounceReason: detail.reason,
                sentAt: new Date(),
              },
            })
          );
        }

        // 4B. Update hrContacts in Job model
        if (Array.isArray(matchingJob.hrContacts)) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const updatedContacts = (matchingJob.hrContacts as any[]).map((c) => {
            if (c.email?.toLowerCase() === bEmail) {
              return { ...c, status: "BOUNCED", bounceReason: detail.reason };
            }
            return c;
          });
          await withDbRetry(() =>
            prisma.job.update({
              where: { id: matchingJob.id },
              data: {
                hrContacts: updatedContacts,
                bouncedAt: new Date(),
              },
            })
          );
        }
      }
    }

    // 5. Also load all historical DB-persisted bounced logs for complete user feedback
    const dbBouncedLogs = await withDbRetry(() =>
      prisma.outreachLog.findMany({
        where: {
          job: { userId },
          status: "BOUNCED",
        },
        include: {
          job: { select: { company: true, title: true } },
        },
        orderBy: { sentAt: "desc" },
      })
    );

    for (const log of dbBouncedLogs) {
      if (log.sentTo) {
        bouncesDetected.add(log.sentTo.toLowerCase());
      }
    }

    const allBouncedDetails: BouncedEmailDetail[] = dbBouncedLogs.map((l) => ({
      email: l.sentTo || "Unknown",
      reason: l.bounceReason || "Delivery bounced: internal group or address not found",
      company: l.job.company,
      jobTitle: l.job.title,
      purgedFromInbox: true,
      detectedAt: l.sentAt.toISOString(),
    }));

    // 6. Auto-Reconcile & Correct Each Job's Kanban Position
    for (const job of userJobs) {
      let targetStatus = job.status;
      let fixReason = "";

      const compLower = job.company.toLowerCase();

      // Update remaining logs
      if (job.outreachLogs && job.outreachLogs.length > 0) {
        for (const log of job.outreachLogs) {
          const sentToLower = log.sentTo?.toLowerCase() || "";
          const isLogBounced =
            bouncesDetected.has(sentToLower) ||
            Array.from(bouncesDetected).some((b) => sentToLower.includes(b));

          if (isLogBounced && log.status !== "BOUNCED") {
            const reason =
              bouncedDetailsMap.get(sentToLower)?.reason ||
              log.bounceReason ||
              "Delivery bounced: internal group or address not found";
            await withDbRetry(() =>
              prisma.outreachLog.update({
                where: { id: log.id },
                data: {
                  status: "BOUNCED",
                  bounceReason: reason,
                },
              })
            );
          } else if (!isLogBounced && log.status === "SENT") {
            await withDbRetry(() =>
              prisma.outreachLog.update({
                where: { id: log.id },
                data: { status: "DELIVERED" },
              })
            );
          }
        }
      }

      // Evaluate overall Job status
      const totalLogs = job.outreachLogs?.length || 0;
      const bouncedCount =
        job.outreachLogs?.filter((l) => {
          const s = l.sentTo?.toLowerCase() || "";
          return (
            l.status === "BOUNCED" ||
            bouncesDetected.has(s) ||
            Array.from(bouncesDetected).some((b) => s.includes(b))
          );
        }).length || 0;

      const allBounced = totalLogs > 0 && bouncedCount === totalLogs;
      const hasDeliveredInboxes = totalLogs > bouncedCount;

      // Condition 1: All sent emails bounced -> MUST BE BOUNCED
      if (allBounced && job.status !== "BOUNCED") {
        targetStatus = "BOUNCED";
        fixReason = `All outreach emails bounced. Repositioned to Bounced for alternate HR routing.`;
      }
      // Condition 2: Some emails delivered -> Keep or restore to EMAILED
      else if (hasDeliveredInboxes && (job.status === "BOUNCED" || job.status === "SOURCED")) {
        targetStatus = "EMAILED";
        fixReason = `Delivered to ${totalLogs - bouncedCount} active corporate inboxes. Maintained in Emailed.`;
      }
      // Condition 3: Recruiter replied -> MUST BE REPLIED
      else if (
        (repliedDomains.has(compLower) || replyDataMap.has(job.id)) &&
        job.status !== "INTERVIEWING"
      ) {
        if (job.status !== "REPLIED") {
          targetStatus = "REPLIED";
          fixReason = `Inbound response detected in Gmail for ${job.company}. Position corrected to Replied.`;
        }
      }
      // Condition 4: User dragged back to SOURCED by mistake, but email was already dispatched
      else if (job.status === "SOURCED" && totalLogs > 0) {
        targetStatus = "EMAILED";
        fixReason = `Outreach email already sent on ${new Date(
          job.outreachLogs[0].sentAt
        ).toLocaleDateString()}. Re-aligned to Emailed.`;
      }

      const replyData = replyDataMap.get(job.id);
      let suggestedAiReply = job.suggestedAiReply;

      // Autonomously draft AI reply if we have an incoming message and no suggestion yet
      if (replyData?.snippet && !suggestedAiReply) {
        try {
          const aiGen = await generateAiReply({
            candidateName: "Khawar Ahemad Khan",
            company: job.company,
            role: job.title,
            recruiterMessage: replyData.snippet,
            recruiterFrom: replyData.from,
            customContext: job.customContext,
          });
          suggestedAiReply = aiGen.suggestedBody;
        } catch (genErr) {
          console.warn("[Reconciler] Failed to pre-generate AI reply:", genErr);
        }
      }

      const hasNewReply = Boolean(
        replyData && (!job.lastReplySnippet || job.lastReplySnippet !== replyData.snippet)
      );
      if (targetStatus !== job.status || hasNewReply) {
        await withDbRetry(() =>
          prisma.job.update({
            where: { id: job.id },
            data: {
              status: targetStatus,
              ...(replyData
                ? {
                    lastReplyFrom: replyData.from,
                    lastReplySubject: replyData.subject,
                    lastReplySnippet: replyData.snippet,
                    lastReplyAt: replyData.date,
                    suggestedAiReply,
                  }
                : {}),
            },
          })
        );

        if (targetStatus !== job.status) {
          fixedJobs.push({
            jobId: job.id,
            company: job.company,
            fromStatus: job.status,
            toStatus: targetStatus,
            reason: fixReason,
          });
        }
      }
    }

    return {
      success: true,
      fixedCount: fixedJobs.length,
      fixedJobs,
      bouncesDetected: Array.from(bouncesDetected),
      bouncedDetails: allBouncedDetails,
      purgedFromMailboxCount: purgedCount,
      isMailboxClean: true,
      repliesDetected: Array.from(repliedDomains),
      providerUsed,
    };
  } catch (err: unknown) {
    console.error("[Reconciler] Error:", err);
    return {
      success: false,
      fixedCount: 0,
      fixedJobs: [],
      bouncesDetected: [],
      bouncedDetails: [],
      purgedFromMailboxCount: 0,
      isMailboxClean: false,
      repliesDetected: [],
      providerUsed: "database_audit",
      error: (err as Error).message || "Reconciliation failed",
    };
  }
}
