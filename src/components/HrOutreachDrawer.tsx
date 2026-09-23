"use client";

import { useState, useEffect } from "react";
import {
  X,
  Mail,
  Users,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Send,
  Building,
  Sparkles,
  ShieldCheck,
  ExternalLink,
  ChevronDown,
  Paperclip,
  FileText,
  RefreshCw,
  Radio,
} from "lucide-react";

import { HrContact } from "@/lib/scrapers/hr-finder";
import { useToast } from "@/components/ToastProvider";

export interface OutreachLogItem {
  id: string;
  sentTo: string;
  status: string;
  messageId?: string | null;
  threadId?: string | null;
  sentAt: string | Date;
}

export interface DrawerJob {
  id: string;
  company: string;
  title: string;
  url?: string | null;
  hrEmail?: string | null;
  hrName?: string | null;
  hrContacts?: HrContact[] | null;
  generatedSubject?: string | null;
  generatedBody?: string | null;
  status: string;
  outreachLogs?: OutreachLogItem[];
  lastReplySnippet?: string | null;
  lastReplyFrom?: string | null;
  lastReplySubject?: string | null;
  lastReplyAt?: string | Date | null;
  suggestedAiReply?: string | null;
}

export interface DispatchBreakdownItem {
  email: string;
  success: boolean;
  messageId?: string;
  error?: string;
  provider?: string;
}

interface HrOutreachDrawerProps {
  job: DrawerJob;
  isOpen: boolean;
  onClose: () => void;
  onJobUpdated?: (updated: DrawerJob) => void;
}

export default function HrOutreachDrawer({
  job,
  isOpen,
  onClose,
  onJobUpdated,
}: HrOutreachDrawerProps) {
  const { addToast, updateToast, removeToast } = useToast();
  const [contacts, setContacts] = useState<HrContact[]>(job.hrContacts || []);
  const [selectedEmails, setSelectedEmails] = useState<Set<string>>(new Set());
  const [isLoadingContacts, setIsLoadingContacts] = useState(false);
  const [isDrafting, setIsDrafting] = useState(false);
  const [isSending, setIsSending] = useState(false);

  const [subject, setSubject] = useState(job.generatedSubject || "");
  const [body, setBody] = useState(job.generatedBody || "");
  const [attachResume, setAttachResume] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [dispatchBreakdown, setDispatchBreakdown] = useState<DispatchBreakdownItem[] | null>(null);
  const [currentLogs, setCurrentLogs] = useState<OutreachLogItem[]>(job.outreachLogs || []);

  // Recruiter Reply & AI Copilot State
  const [replyText, setReplyText] = useState(job.suggestedAiReply || "");
  const [isGeneratingAiReply, setIsGeneratingAiReply] = useState(false);
  const [isSendingReply, setIsSendingReply] = useState(false);

  useEffect(() => {
    if (job.outreachLogs) {
      setCurrentLogs(job.outreachLogs);
    }
  }, [job.outreachLogs]);

  useEffect(() => {
    if (isOpen) {
      refreshJobLogs();
      if (!contacts || contacts.length === 0 || contacts.some((c) => c.email.includes("linkedin.com"))) {
        fetchHrContacts();
      } else {
        const nonBounced = contacts.filter((c) => {
          const isBounced = currentLogs.some(
            (l) => l.sentTo?.toLowerCase() === c.email.toLowerCase() && l.status === "BOUNCED"
          );
          return !isBounced;
        });
        setSelectedEmails(new Set(nonBounced.length > 0 ? nonBounced.map((c) => c.email) : contacts.map((c) => c.email)));
      }

      if (!subject || !body) {
        generateDraft();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const refreshJobLogs = async () => {
    try {
      const res = await fetch("/api/jobs");
      const data = await res.json();
      if (data.jobs) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const found = data.jobs.find((j: any) => j.id === job.id);
        if (found?.outreachLogs) {
          setCurrentLogs(found.outreachLogs);
        }
      }
    } catch {
      // ignore
    }
  };

  const fetchHrContacts = async () => {
    setIsLoadingContacts(true);
    setErrorMsg(null);
    try {
      const res = await fetch("/api/jobs/find-hr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId: job.id, company: job.company, url: job.url }),
      });
      const data = await res.json();
      const discovered = data.contacts || data.hrDiscovery?.contacts;
      if (discovered) {
        setContacts(discovered);
        setSelectedEmails(new Set(discovered.map((c: HrContact) => c.email)));
      }
    } catch (err: unknown) {
      setErrorMsg((err as Error).message);
    } finally {
      setIsLoadingContacts(false);
    }
  };


  const generateDraft = async () => {
    setIsDrafting(true);
    try {
      const res = await fetch("/api/jobs/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId: job.id }),
      });
      const data = await res.json();
      if (data.draft) {
        setSubject(data.draft.subject);
        setBody(data.draft.body);
      }
    } catch (err) {
      console.warn("Draft generation notice:", err);
    } finally {
      setIsDrafting(false);
    }
  };

  const toggleEmail = (email: string) => {
    const updated = new Set(selectedEmails);
    if (updated.has(email)) {
      updated.delete(email);
    } else {
      updated.add(email);
    }
    setSelectedEmails(updated);
  };

  const handleGenerateAiReply = async () => {
    setIsGeneratingAiReply(true);
    setErrorMsg(null);
    try {
      const res = await fetch("/api/jobs/reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "suggest", jobId: job.id }),
      });
      const data = await res.json();
      if (data.aiReply?.suggestedBody) {
        setReplyText(data.aiReply.suggestedBody);
        setSuccessMsg("AI synthesized an optimized response for this recruiter!");
      }
    } catch (err: unknown) {
      setErrorMsg((err as Error).message);
    } finally {
      setIsGeneratingAiReply(false);
    }
  };

  const handleSendReply = async () => {
    if (!replyText) {
      setErrorMsg("Please enter a reply message.");
      return;
    }
    setIsSendingReply(true);
    setErrorMsg(null);
    try {
      const res = await fetch("/api/jobs/reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "send",
          jobId: job.id,
          toEmail: job.lastReplyFrom || job.hrEmail,
          replyBody: replyText,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to dispatch reply");

      setSuccessMsg("Reply successfully dispatched via Gmail! Pipeline status advanced to Interviewing.");
      if (onJobUpdated) {
        onJobUpdated({
          ...job,
          status: "INTERVIEWING",
          suggestedAiReply: replyText,
        });
      }
    } catch (err: unknown) {
      setErrorMsg((err as Error).message);
    } finally {
      setIsSendingReply(false);
    }
  };

  const handleApplyAndSend = async () => {
    if (selectedEmails.size === 0) {
      setErrorMsg("Please select at least one recipient HR contact.");
      return;
    }
    if (!subject || !body) {
      setErrorMsg("Please ensure an email subject and body are provided.");
      return;
    }

    const emailList = Array.from(selectedEmails);

    // 1. Show active sending notification on right side with live sending process
    const sendingToastId = addToast({
      title: `Sending to ${job.company}`,
      message: `Delivering application to ${emailList.length} HR contacts with ATS resume PDF attached...`,
      type: "loading",
      step: "Connecting to Gmail & delivering messages...",
    });

    // Dynamic process status update while in transmission
    const progressTimer = setTimeout(() => {
      updateToast(sendingToastId, {
        step: `Transmitting ${emailList.length} inboxes with ATS resume PDF...`,
      });
    }, 2500);

    // 2. Instantly close drawer so user can immediately browse or apply to other jobs without waiting
    onClose();

    // 3. Dispatch via Gmail asynchronously
    try {
      const res = await fetch("/api/jobs/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobId: job.id,
          toEmails: emailList,
          subject,
          emailBody: body,
          attachResume,
        }),
      });

      clearTimeout(progressTimer);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to dispatch email via Gmail");

      const count = data.dispatchedCount ?? emailList.length;

      // 4. Remove sending notification
      removeToast(sendingToastId);

      // 5. Spawn NEW completion notification that automatically disappears after exactly 5 seconds
      addToast({
        title: `Application Sent to ${job.company}!`,
        message: `Done! Dispatched via Gmail to all ${count} HR contacts with ATS resume attached.`,
        type: "success",
        duration: 5000,
      });

      const newOutreachLogs: OutreachLogItem[] = (data.breakdown || []).map(
        (b: DispatchBreakdownItem, idx: number) => ({
          id: `log-${Date.now()}-${idx}`,
          sentTo: b.email,
          status: b.success ? "SENT" : "FAILED",
          messageId: b.messageId || null,
          sentAt: new Date().toISOString(),
        })
      );

      const updatedJob: DrawerJob = {
        ...job,
        status: "EMAILED",
        hrEmail: emailList[0],
        generatedSubject: subject,
        generatedBody: body,
        hrContacts: contacts,
        outreachLogs: newOutreachLogs.length > 0 ? newOutreachLogs : job.outreachLogs,
      };

      if (onJobUpdated) onJobUpdated(updatedJob);
    } catch (err: unknown) {
      clearTimeout(progressTimer);
      removeToast(sendingToastId);
      addToast({
        title: `Failed to Send (${job.company})`,
        message: (err as Error).message || "Failed to dispatch email via Gmail",
        type: "error",
        duration: 5000,
      });
    }
  };

  // Compile live delivery status per unique recipient inbox
  const recipientDeliveryList = contacts.map((c) => {
    const emailKey = c.email.toLowerCase();
    const matchingLog = currentLogs.find((l) => l.sentTo?.toLowerCase() === emailKey);
    const fallbackDispatch = dispatchBreakdown?.find((b) => b.email.toLowerCase() === emailKey);

    let status: "DELIVERED" | "BOUNCED" | "REPLIED" | "SENT" | "PENDING" = "PENDING";
    let messageId: string | null | undefined = null;
    let bounceReason: string | null | undefined = null;

    if (matchingLog) {
      status = (matchingLog.status as any) || "SENT";
      messageId = matchingLog.messageId;
      bounceReason = (matchingLog as any).bounceReason;
    } else if (fallbackDispatch) {
      status = fallbackDispatch.success ? "SENT" : "BOUNCED";
      messageId = fallbackDispatch.messageId;
    }

    return {
      contact: c,
      email: c.email,
      status,
      messageId,
      bounceReason,
    };
  });

  const hasOutreachActivity =
    currentLogs.length > 0 ||
    Boolean(dispatchBreakdown && dispatchBreakdown.length > 0) ||
    job.status === "EMAILED" ||
    job.status === "REPLIED" ||
    job.status === "BOUNCED";

  const deliveredCount = recipientDeliveryList.filter((r) => r.status === "DELIVERED" || r.status === "SENT").length;
  const bouncedCount = recipientDeliveryList.filter((r) => r.status === "BOUNCED").length;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-end bg-black/75 backdrop-blur-sm animate-in fade-in">
      <div className="relative h-full w-full max-w-lg sm:max-w-xl bg-[#101014] border-l border-zinc-800 p-4 sm:p-5 flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-zinc-800/80 pb-3">
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 font-medium">
                Autonomous HR Discovery
              </span>
              <span className="text-[10px] text-zinc-500">{contacts.length} Target Contacts</span>
            </div>
            <h2 className="text-base font-bold text-white mt-1 leading-tight">{job.company}</h2>
            <p className="text-[11px] text-zinc-400 mt-0.5 truncate max-w-sm">{job.title}</p>
          </div>

          <button
            onClick={onClose}
            className="p-1 text-zinc-400 hover:text-white rounded-md hover:bg-zinc-800 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto py-3.5 flex flex-col gap-3.5 pr-0.5">
          {errorMsg && (
            <div className="flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-2.5 text-[11px] text-red-300">
              <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-2.5 text-[11px] text-emerald-300">
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Inbound Recruiter Response & AI Reply Copilot (If replied or reply detected) */}
          {(job.lastReplySnippet || job.status === "REPLIED" || job.status === "INTERVIEWING") && (
            <div className="rounded-lg border border-blue-500/40 bg-gradient-to-b from-blue-500/10 to-transparent p-3 flex flex-col gap-2.5 shadow-md shadow-blue-500/5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <div className="h-2 w-2 rounded-full bg-blue-400 animate-ping" />
                  <span className="text-[11px] font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                    <Mail className="h-3 w-3 text-blue-400" /> Inbound Recruiter Response
                  </span>
                </div>
                <span className="text-[9px] px-2 py-0.2 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30 font-mono">
                  {job.lastReplyFrom || job.hrEmail || "Recruiter"}
                </span>
              </div>

              {/* Message from recruiter */}
              <div className="p-2.5 rounded-lg bg-[#09090e] border border-blue-500/20 text-[11px] text-zinc-200">
                <div className="text-[10px] text-zinc-400 font-medium mb-1 flex items-center justify-between">
                  <span className="font-semibold text-white">{job.lastReplySubject || `Re: Application for ${job.title}`}</span>
                  {job.lastReplyAt && (
                    <span className="text-[9px] text-zinc-500 font-mono">
                      {new Date(job.lastReplyAt).toLocaleDateString()} {new Date(job.lastReplyAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  )}
                </div>
                <p className="italic text-zinc-300 leading-relaxed bg-zinc-900/60 p-2 rounded border border-zinc-800/60">
                  &ldquo;{job.lastReplySnippet || "Recruiter sent an inbound response to your outreach email in Gmail."}&rdquo;
                </p>
              </div>

              {/* AI Reply Copilot */}
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-indigo-300 flex items-center gap-1">
                    <Sparkles className="h-3 w-3 text-indigo-400" /> AI Suggested Follow-Up (NVIDIA NIM)
                  </span>
                  <button
                    type="button"
                    onClick={handleGenerateAiReply}
                    disabled={isGeneratingAiReply}
                    className="flex items-center gap-1 text-[10px] text-indigo-400 hover:text-indigo-300 transition-colors"
                  >
                    {isGeneratingAiReply ? (
                      <Loader2 className="h-2.5 w-2.5 animate-spin" />
                    ) : (
                      <RefreshCw className="h-2.5 w-2.5" />
                    )}
                    Regenerate
                  </button>
                </div>

                <textarea
                  rows={3}
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder="Click Regenerate or type response to recruiter..."
                  className="w-full rounded-lg border border-zinc-800 bg-[#09090b] p-2 text-[11px] text-zinc-200 font-mono leading-relaxed focus:border-indigo-500/50 focus:outline-none resize-none"
                />

                <div className="flex items-center justify-between mt-0.5">
                  <span className="text-[10px] text-zinc-500">
                    To: <strong className="text-zinc-300">{job.lastReplyFrom || job.hrEmail}</strong>
                  </span>
                  <button
                    type="button"
                    onClick={handleSendReply}
                    disabled={isSendingReply || !replyText}
                    className="flex items-center gap-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 px-3 py-1.5 text-[11px] font-bold text-white transition-all shadow-sm disabled:opacity-40"
                  >
                    {isSendingReply ? (
                      <>
                        <Loader2 className="h-3 w-3 animate-spin" /> Sending...
                      </>
                    ) : (
                      <>
                        <Send className="h-3 w-3" /> Dispatch Reply
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 5-Inbox Outreach Delivery Breakdown */}
          {hasOutreachActivity && (
            <div className="rounded-lg border border-indigo-500/30 bg-indigo-500/5 p-3 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                  <span className="text-[11px] font-bold text-white uppercase tracking-wider">
                    Outreach Delivery Breakdown
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono">
                    {deliveredCount} Active
                  </span>
                  {bouncedCount > 0 && (
                    <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 font-mono">
                      {bouncedCount} Bounced
                    </span>
                  )}
                  <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 font-mono">
                    PDF Attached
                  </span>
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                {recipientDeliveryList.map((item, idx) => (
                  <div
                    key={idx}
                    className={`flex items-center justify-between px-2.5 py-1.5 rounded-md border text-[11px] transition-all ${
                      item.status === "DELIVERED" || item.status === "SENT"
                        ? "bg-[#0d0d12] border-emerald-500/20"
                        : item.status === "BOUNCED"
                        ? "bg-[#140e0e] border-amber-500/20"
                        : "bg-[#0d0d12] border-zinc-800"
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div
                        className={`h-2 w-2 min-w-[8px] min-h-[8px] aspect-square rounded-full shrink-0 ${
                          item.status === "DELIVERED"
                            ? "bg-emerald-400 shadow-sm shadow-emerald-400/60"
                            : item.status === "SENT"
                            ? "bg-emerald-400"
                            : item.status === "REPLIED"
                            ? "bg-blue-400 shadow-sm shadow-blue-400/60"
                            : item.status === "BOUNCED"
                            ? "bg-amber-400"
                            : "bg-zinc-600"
                        }`}
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-zinc-200 truncate">{item.email}</span>
                          <span className="text-[9px] text-zinc-500 font-sans truncate">({item.contact.role})</span>
                        </div>
                        {item.bounceReason && (
                          <div className="flex flex-wrap items-center gap-1 mt-0.5">
                            <span className="text-[9px] text-amber-400 font-sans">
                              {item.bounceReason}
                            </span>
                            <span className="text-[8px] px-1 py-0.2 rounded bg-zinc-800 text-zinc-400 border border-zinc-700 font-sans">
                              Cleaned from Inbox • Saved in DB
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0 ml-2">
                      {item.messageId && (
                        <span className="text-[9px] font-mono text-zinc-500 truncate max-w-[85px] hidden sm:inline">
                          MsgID: {item.messageId.slice(0, 10)}..
                        </span>
                      )}
                      <span
                        className={`text-[9px] px-1.5 py-0.5 rounded font-medium ${
                          item.status === "DELIVERED"
                            ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                            : item.status === "SENT"
                            ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                            : item.status === "REPLIED"
                            ? "bg-blue-500/10 text-blue-400 border border-blue-500/30"
                            : item.status === "BOUNCED"
                            ? "bg-amber-500/10 text-amber-400 border border-amber-500/30"
                            : "bg-zinc-800 text-zinc-400"
                        }`}
                      >
                        {item.status === "DELIVERED"
                          ? "DELIVERED"
                          : item.status === "SENT"
                          ? "DISPATCHED"
                          : item.status === "REPLIED"
                          ? "REPLIED"
                          : item.status === "BOUNCED"
                          ? "BOUNCED"
                          : "PENDING"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* HR Contacts List */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-[11px] font-semibold uppercase tracking-wider text-zinc-300 flex items-center gap-1.5">
                <Users className="h-3 w-3 text-indigo-400" /> Discovered HR / Recruiter Inboxes ({contacts.length})
              </h3>
              <div className="flex items-center gap-1.5 text-[10px]">
                <button
                  type="button"
                  onClick={() => setSelectedEmails(new Set(contacts.map((c) => c.email)))}
                  className="text-indigo-400 hover:text-indigo-300 transition-colors"
                >
                  Select All
                </button>
                <span className="text-zinc-600">|</span>
                <button
                  type="button"
                  onClick={() => setSelectedEmails(new Set())}
                  className="text-zinc-500 hover:text-zinc-300 transition-colors"
                >
                  Clear
                </button>
                <span className="text-zinc-500 ml-1">
                  ({selectedEmails.size}/{contacts.length} Selected)
                </span>
              </div>
            </div>

            {isLoadingContacts ? (
              <div className="flex items-center justify-center p-6 rounded-lg border border-zinc-800/80 bg-zinc-900/30 text-[11px] text-zinc-400 gap-2">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-indigo-400" /> Probing corporate MX and scraping recruiter contacts...
              </div>
            ) : (
              <div className="flex flex-col gap-1.5">
                {contacts.map((contact) => {
                  const isChecked = selectedEmails.has(contact.email);
                  const matchingDelivery = recipientDeliveryList.find(
                    (r) => r.email.toLowerCase() === contact.email.toLowerCase()
                  );
                  const isBounced =
                    matchingDelivery?.status === "BOUNCED" ||
                    currentLogs.some(
                      (l) => l.sentTo?.toLowerCase() === contact.email.toLowerCase() && l.status === "BOUNCED"
                    );

                  return (
                    <div
                      key={contact.id}
                      onClick={() => toggleEmail(contact.email)}
                      className={`flex items-center justify-between p-2 rounded-lg border cursor-pointer transition-all ${
                        isBounced
                          ? "border-amber-500/20 bg-amber-500/5 hover:bg-amber-500/10 opacity-80"
                          : isChecked
                          ? "border-indigo-500/50 bg-indigo-500/10 shadow-sm"
                          : "border-zinc-800/70 bg-zinc-900/20 hover:bg-zinc-800/30"
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {}} // handled by parent onClick
                          className="h-3.5 w-3.5 min-w-[14px] min-h-[14px] aspect-square shrink-0 rounded border-zinc-700 bg-zinc-900 text-indigo-600 focus:ring-0"
                        />
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span
                              className={`text-[11px] font-semibold truncate ${
                                isBounced ? "text-zinc-400 line-through" : "text-white"
                              }`}
                            >
                              {contact.name}
                            </span>
                            <span className="text-[9px] px-1.5 py-0.2 rounded bg-zinc-800 text-zinc-400 border border-zinc-700/60 font-medium">
                              {contact.role}
                            </span>
                            {contact.linkedInUrl && (
                              <a
                                href={contact.linkedInUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                title="Open recruiter profile on LinkedIn"
                                className="inline-flex items-center gap-0.5 text-[9px] px-1 py-0.2 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 hover:bg-blue-500/20 transition-colors"
                              >
                                <span>LinkedIn</span>
                                <ExternalLink className="h-2.5 w-2.5" />
                              </a>
                            )}
                            {isBounced && (
                              <span className="text-[8px] px-1 py-0.2 rounded bg-amber-500/10 text-amber-400 border border-amber-500/30 font-medium">
                                BOUNCED (Cleaned)
                              </span>
                            )}
                          </div>
                          <span
                            className={`text-[10px] font-mono block truncate ${
                              isBounced ? "text-zinc-500" : "text-indigo-300"
                            }`}
                          >
                            {contact.email}
                          </span>
                          {isBounced && (
                            <span className="text-[9px] text-amber-400/90 block mt-0.5 font-sans">
                              {matchingDelivery?.bounceReason || "Delivery bounced"} • Preserved in DB
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="text-right shrink-0 ml-2">
                        <span
                          className={`text-[9px] px-1.5 py-0.2 rounded-full font-medium ${
                            isBounced
                              ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                              : contact.isEmployee || contact.source?.includes("LinkedIn")
                              ? "bg-sky-500/10 text-sky-400 border border-sky-500/20"
                              : contact.confidence === "Verified"
                              ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                              : "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                          }`}
                        >
                          {isBounced ? "Failed" : contact.isEmployee ? "LinkedIn Match" : contact.confidence}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* AI Tailored Pitch Preview */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <h3 className="text-[11px] font-semibold uppercase tracking-wider text-zinc-300 flex items-center gap-1.5">
                <Sparkles className="h-3 w-3 text-indigo-400" /> Tailored Cold Outreach Pitch
              </h3>
              {isDrafting && (
                <span className="text-[10px] text-zinc-400 flex items-center gap-1">
                  <Loader2 className="h-2.5 w-2.5 animate-spin text-indigo-400" /> Synthesizing with NVIDIA NIM...
                </span>
              )}
            </div>

            <div>
              <label className="text-[10px] font-medium text-zinc-400 uppercase tracking-wider block mb-0.5">
                Subject
              </label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Personalized subject..."
                className="w-full rounded-lg border border-zinc-800 bg-[#09090b] px-3 py-1.5 text-xs text-white focus:border-zinc-700 focus:outline-none"
              />
            </div>

            <div>
              <label className="text-[10px] font-medium text-zinc-400 uppercase tracking-wider block mb-0.5">
                Body
              </label>
              <textarea
                rows={4}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="The AI will weave your resume projects with the company tech stack here..."
                className="w-full rounded-lg border border-zinc-800 bg-[#09090b] p-2.5 text-[11px] text-zinc-200 font-mono leading-relaxed focus:border-zinc-700 focus:outline-none resize-none"
              />
            </div>
          </div>

          {/* Attached Candidate Resume Banner */}
          <div className="rounded-lg border border-zinc-800/80 bg-zinc-900/40 p-2.5 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="h-7 w-7 min-w-[28px] min-h-[28px] aspect-square rounded-md bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shrink-0">
                <FileText className="h-3.5 w-3.5" />
              </div>
              <div>
                <div className="text-[11px] font-semibold text-white flex items-center gap-1.5">
                  <span className="truncate max-w-[220px]">Khawar_Ahemad_Khan_Resume.pdf</span>
                  <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono shrink-0">
                    PDF Attached
                  </span>
                </div>
                <div className="text-[10px] text-zinc-500">
                  ATS-optimized PDF resume attached automatically.
                </div>
              </div>
            </div>

            <label className="flex items-center gap-1.5 cursor-pointer select-none pl-2.5 border-l border-zinc-800">
              <input
                type="checkbox"
                checked={attachResume}
                onChange={(e) => setAttachResume(e.target.checked)}
                className="h-3.5 w-3.5 min-w-[14px] min-h-[14px] aspect-square rounded border-zinc-700 bg-zinc-900 text-indigo-600 focus:ring-0 cursor-pointer"
              />
              <span className="text-[11px] text-zinc-300 font-medium whitespace-nowrap">
                {attachResume ? "Include PDF" : "Omit"}
              </span>
            </label>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between border-t border-zinc-800/80 pt-2.5 mt-auto">
          <button
            onClick={onClose}
            className="rounded-lg px-3 py-1.5 text-xs font-medium text-zinc-400 hover:text-white hover:bg-zinc-800/50 transition-colors"
          >
            Cancel
          </button>

          <button
            onClick={handleApplyAndSend}
            disabled={isSending || selectedEmails.size === 0 || !subject || !body}
            className="flex items-center gap-1.5 rounded-lg bg-white hover:bg-zinc-200 px-3.5 py-1.5 text-xs font-bold text-black transition-all shadow-md shadow-white/10 disabled:opacity-40"
          >
            {isSending ? (
              <>
                <Loader2 className="h-3 w-3 animate-spin" /> Dispatching via Gmail...
              </>
            ) : (
              <>
                <Send className="h-3 w-3" /> Approve & Apply ({selectedEmails.size} Contacts)
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
