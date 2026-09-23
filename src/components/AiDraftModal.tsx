"use client";

import { useState } from "react";
import {
  Sparkles,
  Globe,
  Send,
  CheckCircle2,
  AlertCircle,
  X,
  Loader2,
  RefreshCw,
  Cpu,
  Mail,
  Building,
} from "lucide-react";

export interface JobLead {
  id: string;
  company: string;
  title: string;
  url?: string | null;
  hrEmail?: string | null;
  hrName?: string | null;
  status: string;
  customContext?: string | null;
  researchedInfo?: string | null;
  generatedSubject?: string | null;
  generatedBody?: string | null;
  hrContacts?: any;
  outreachLogs?: any[];
  lastReplySnippet?: string | null;
  lastReplyFrom?: string | null;
  lastReplySubject?: string | null;
  lastReplyAt?: string | Date | null;
  suggestedAiReply?: string | null;
}

interface AiDraftModalProps {
  job: JobLead;
  isOpen: boolean;
  onClose: () => void;
  onJobUpdated: (updatedJob: JobLead) => void;
}

export default function AiDraftModal({
  job,
  isOpen,
  onClose,
  onJobUpdated,
}: AiDraftModalProps) {
  const [isResearching, setIsResearching] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [subject, setSubject] = useState(job.generatedSubject || "");
  const [body, setBody] = useState(job.generatedBody || "");
  const [hrEmail, setHrEmail] = useState(job.hrEmail || "");
  const [researchData, setResearchData] = useState<{
    summary?: string;
    techKeywords?: string[];
    recentHighlights?: string[];
  } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleResearchAndDraft = async () => {
    setIsResearching(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await fetch("/api/jobs/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId: job.id }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to generate draft");

      setSubject(data.draft.subject);
      setBody(data.draft.body);
      setResearchData({
        summary: data.research.summary,
        techKeywords: data.research.techKeywords,
        recentHighlights: data.research.recentHighlights,
      });

      onJobUpdated({
        ...job,
        generatedSubject: data.draft.subject,
        generatedBody: data.draft.body,
        researchedInfo: data.research.rawContext,
      });
    } catch (err: unknown) {
      setErrorMsg((err as Error).message);
    } finally {
      setIsResearching(false);
    }
  };

  const handleSendViaGmail = async () => {
    if (!hrEmail) {
      setErrorMsg("Please provide a recipient email address.");
      return;
    }
    if (!subject || !body) {
      setErrorMsg("Please generate or draft an email subject and body first.");
      return;
    }

    setIsSending(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await fetch("/api/jobs/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobId: job.id,
          toEmail: hrEmail,
          subject,
          emailBody: body,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to send email");

      setSuccessMsg("Email successfully dispatched via Gmail API!");
      onJobUpdated({
        ...job,
        status: "EMAILED",
        hrEmail,
        generatedSubject: subject,
        generatedBody: body,
      });

      setTimeout(() => {
        onClose();
      }, 1800);
    } catch (err: unknown) {
      setErrorMsg((err as Error).message);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-3xl rounded-2xl border border-zinc-800 bg-[#101014] p-6 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-zinc-800/80 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-500 to-violet-600 text-white shadow-md shadow-indigo-500/20">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                AI Outreach Studio
                <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                  Live Web Access
                </span>
              </h2>
              <p className="text-xs text-zinc-400">
                {job.title} at <strong className="text-zinc-200">{job.company}</strong>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto py-5 flex flex-col gap-5 pr-1">
          {errorMsg && (
            <div className="flex items-start gap-2.5 rounded-xl border border-red-500/30 bg-red-500/10 p-3.5 text-xs text-red-300">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="flex items-center gap-2.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3.5 text-xs text-emerald-300">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Target Info Inputs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-medium text-zinc-400 uppercase tracking-wider block mb-1">
                Recipient Email
              </label>
              <input
                type="email"
                placeholder="recruiting@company.com"
                value={hrEmail}
                onChange={(e) => setHrEmail(e.target.value)}
                className="w-full rounded-lg border border-zinc-800 bg-[#09090b] px-3 py-2 text-xs text-zinc-100 placeholder:text-zinc-600 focus:border-zinc-700 focus:outline-none"
              />
            </div>
            <div>
              <label className="text-[11px] font-medium text-zinc-400 uppercase tracking-wider block mb-1">
                Autonomous Research Engine
              </label>
              <button
                onClick={handleResearchAndDraft}
                disabled={isResearching}
                className="w-full flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 px-4 py-2 text-xs font-medium text-white transition-all shadow-md shadow-indigo-600/20 disabled:opacity-50"
              >
                {isResearching ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Searching Web & Drafting...
                  </>
                ) : (
                  <>
                    <Globe className="h-3.5 w-3.5" />
                    {subject ? "Re-crawl & Re-draft" : "Research Web & Draft Email"}
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Research Insight Card */}
          {researchData && (
            <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/40 p-4 animate-in fade-in">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-indigo-400 flex items-center gap-1.5">
                  <Cpu className="h-3.5 w-3.5" /> Extracted Company Intelligence
                </span>
                <span className="text-[10px] text-zinc-500">Live Web Sources</span>
              </div>
              <p className="text-xs text-zinc-300 leading-relaxed mb-3">
                {researchData.summary}
              </p>
              {researchData.techKeywords && researchData.techKeywords.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {researchData.techKeywords.map((tag, i) => (
                    <span
                      key={i}
                      className="rounded-md bg-zinc-800/80 border border-zinc-700/50 px-2 py-0.5 text-[10px] font-medium text-zinc-300"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Subject Line */}
          <div>
            <label className="text-[11px] font-medium text-zinc-400 uppercase tracking-wider block mb-1">
              Personalized Subject
            </label>
            <input
              type="text"
              placeholder="Click 'Research Web & Draft' to generate..."
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full rounded-lg border border-zinc-800 bg-[#09090b] px-3.5 py-2.5 text-xs text-zinc-100 placeholder:text-zinc-600 focus:border-zinc-700 focus:outline-none"
            />
          </div>

          {/* Email Body */}
          <div className="flex flex-col flex-1">
            <label className="text-[11px] font-medium text-zinc-400 uppercase tracking-wider block mb-1">
              Email Content
            </label>
            <textarea
              rows={8}
              placeholder="The autonomous AI will research company highlights and draft a personalized, high-converting cold email here..."
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className="w-full rounded-lg border border-zinc-800 bg-[#09090b] p-3.5 text-xs text-zinc-200 font-mono leading-relaxed placeholder:text-zinc-600 focus:border-zinc-700 focus:outline-none resize-none"
            />
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between border-t border-zinc-800/80 pt-4 mt-auto">
          <button
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-xs font-medium text-zinc-400 hover:text-white transition-colors"
          >
            Cancel
          </button>

          <div className="flex items-center gap-2.5">
            <button
              onClick={handleSendViaGmail}
              disabled={isSending || isResearching || !subject || !body}
              className="flex items-center gap-2 rounded-lg bg-white hover:bg-zinc-200 px-4 py-2 text-xs font-medium text-black transition-all shadow-md shadow-white/10 disabled:opacity-40"
            >
              {isSending ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Sending via Gmail...
                </>
              ) : (
                <>
                  <Send className="h-3.5 w-3.5" />
                  Send via Gmail
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
