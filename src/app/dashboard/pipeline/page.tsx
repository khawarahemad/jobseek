"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import {
  Plus,
  Search,
  Sparkles,
  ExternalLink,
  ChevronRight,
  ChevronLeft,
  X,
  Loader2,
  Building,
  RefreshCw,
  Users,
  CheckCircle2,
  AlertTriangle,
  GripVertical,
  Radio,
  Check,
  ShieldAlert,
  ArrowUpRight,
  Bell,
} from "lucide-react";
import AiDraftModal, { JobLead } from "@/components/AiDraftModal";
import HrOutreachDrawer, { DrawerJob } from "@/components/HrOutreachDrawer";
import { useToast } from "@/components/ToastProvider";

const COLUMNS = [
  { id: "SOURCED", title: "Sourced", dotColor: "bg-zinc-400" },
  { id: "EMAILED", title: "Emailed", dotColor: "bg-indigo-400" },
  { id: "REPLIED", title: "Replied", dotColor: "bg-sky-400" },
  { id: "INTERVIEWING", title: "Interviewing", dotColor: "bg-emerald-400" },
  { id: "BOUNCED", title: "Bounced", dotColor: "bg-amber-400" },
];

function getAvatarGradient(name: string) {
  const gradients = [
    "from-indigo-600/30 to-violet-600/30 text-indigo-300 border-indigo-500/30",
    "from-blue-600/30 to-cyan-600/30 text-blue-300 border-blue-500/30",
    "from-emerald-600/30 to-teal-600/30 text-emerald-300 border-emerald-500/30",
    "from-amber-600/30 to-orange-600/30 text-amber-300 border-amber-500/30",
    "from-purple-600/30 to-pink-600/30 text-purple-300 border-purple-500/30",
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return gradients[Math.abs(hash) % gradients.length];
}

export default function PipelinePage() {
  const [jobs, setJobs] = useState<JobLead[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedJobForAi, setSelectedJobForAi] = useState<JobLead | null>(null);
  const [selectedJobForHrDrawer, setSelectedJobForHrDrawer] = useState<DrawerJob | null>(null);

  // Drag and Drop States
  const [draggedJobId, setDraggedJobId] = useState<string | null>(null);
  const [dragOverColId, setDragOverColId] = useState<string | null>(null);

  // Monitor Scan & Auto-Reconcile State
  const [isScanning, setIsScanning] = useState(false);
  const [toastNotice, setToastNotice] = useState<{ id: number; message: string; type: "success" | "info" } | null>(null);
  const [autoSyncEnabled, setAutoSyncEnabled] = useState(true);
  const [isMailboxClean, setIsMailboxClean] = useState(true);
  const [showBouncedModal, setShowBouncedModal] = useState(false);
  const syncTimerRef = useRef<NodeJS.Timeout | null>(null);

  // New Lead Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newCompany, setNewCompany] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const [newHrEmail, setNewHrEmail] = useState("");
  const [newContext, setNewContext] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Compute all bounced recipient inboxes currently saved in DB
  const allBouncedLogs = useMemo(() => {
    const list: Array<{
      id: string;
      email: string;
      reason: string;
      company: string;
      title: string;
      jobId: string;
      sentAt: string | Date;
    }> = [];
    for (const j of jobs) {
      if ((j as any).outreachLogs) {
        for (const log of (j as any).outreachLogs) {
          if (log.status === "BOUNCED" && log.sentTo) {
            list.push({
              id: log.id,
              email: log.sentTo,
              reason: log.bounceReason || "Delivery bounced: internal group or address not found",
              company: j.company,
              title: j.title,
              jobId: j.id,
              sentAt: log.sentAt,
            });
          }
        }
      }
    }
    return list;
  }, [jobs]);

  useEffect(() => {
    fetchJobs();
    handleScanInbox(true, false);
  }, []);

  // Background Auto-Sync: 60s cooldown, silent background check
  useEffect(() => {
    if (autoSyncEnabled) {
      syncTimerRef.current = setInterval(() => {
        handleScanInbox(true, false);
      }, 60000);
    } else if (syncTimerRef.current) {
      clearInterval(syncTimerRef.current);
    }
    return () => {
      if (syncTimerRef.current) clearInterval(syncTimerRef.current);
    };
  }, [autoSyncEnabled]);

  const { addToast } = useToast();

  const showToast = (message: string, type: "success" | "info" = "success") => {
    addToast({ message, type });
  };

  const fetchJobs = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/jobs");
      const data = await res.json();
      if (data.jobs) {
        setJobs(data.jobs);
      }
    } catch (err) {
      console.error("Failed to fetch jobs:", err);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Scans Gmail and auto-corrects misplaced cards.
   * If mailbox is already clean, it marks clean and avoids continuous redundant purging.
   */
  const handleScanInbox = async (silent = false, force = false) => {
    if (!silent) setIsScanning(true);
    try {
      const res = await fetch("/api/jobs/monitor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ force }),
      });
      const data = await res.json();

      if (data.success) {
        setIsMailboxClean(true);

        if (data.purgedFromMailboxCount > 0 || (data.fixedJobs && data.fixedJobs.length > 0)) {
          const jobsRes = await fetch("/api/jobs");
          const jobsData = await jobsRes.json();
          if (jobsData.jobs) {
            setJobs(jobsData.jobs);
          }
        }

        if (data.purgedFromMailboxCount > 0) {
          showToast(
            `Cleaned: ${data.purgedFromMailboxCount} bounce notice(s) removed from Gmail & logged to DB.`,
            "success"
          );
        } else if (data.fixedJobs && data.fixedJobs.length > 0) {
          const names = data.fixedJobs.map((f: { company: string; toStatus: string }) => `${f.company} -> ${f.toStatus}`).join(", ");
          showToast(`Auto-aligned ${data.fixedJobs.length} card(s): ${names}`, "info");
        } else if (!silent) {
          showToast(`Mailbox Clean: Synchronized (${allBouncedLogs.length} bounces in DB).`, "success");
        }
      } else if (!silent) {
        showToast(data.error || "Gmail scan complete.", "info");
      }
    } catch (err) {
      console.warn("Mail sync notice:", err);
    } finally {
      if (!silent) setIsScanning(false);
    }
  };

  /**
   * Changes status and persists to database
   */
  const handleStatusChange = async (jobId: string, newStatus: string) => {
    try {
      setJobs((prev) => prev.map((j) => (j.id === jobId ? { ...j, status: newStatus } : j)));
      await fetch("/api/jobs", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: jobId, status: newStatus }),
      });
    } catch (err) {
      console.error("Failed to update status:", err);
    }
  };

  /**
   * Shift card forward or backward by one column
   */
  const handleStepStatus = (jobId: string, currentStatus: string, direction: "prev" | "next") => {
    const currentIndex = COLUMNS.findIndex((c) => c.id === currentStatus);
    if (currentIndex === -1) return;
    const newIndex = direction === "next" ? currentIndex + 1 : currentIndex - 1;
    if (newIndex >= 0 && newIndex < COLUMNS.length) {
      handleStatusChange(jobId, COLUMNS[newIndex].id);
    }
  };

  // HTML5 Drag and Drop
  const handleDragStart = (e: React.DragEvent, jobId: string) => {
    e.dataTransfer.setData("text/plain", jobId);
    e.dataTransfer.effectAllowed = "move";
    setDraggedJobId(jobId);
  };

  const handleDragEnd = () => {
    setDraggedJobId(null);
    setDragOverColId(null);
  };

  const handleDragOver = (e: React.DragEvent, colId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dragOverColId !== colId) {
      setDragOverColId(colId);
    }
  };

  const handleDragLeave = (e: React.DragEvent, colId: string) => {
    const related = e.relatedTarget as HTMLElement | null;
    if (!related || !e.currentTarget.contains(related)) {
      if (dragOverColId === colId) {
        setDragOverColId(null);
      }
    }
  };

  const handleDrop = (e: React.DragEvent, targetStatus: string) => {
    e.preventDefault();
    const jobId = e.dataTransfer.getData("text/plain") || draggedJobId;
    setDragOverColId(null);
    setDraggedJobId(null);
    if (jobId) {
      handleStatusChange(jobId, targetStatus);
    }
  };

  const handleCreateLead = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCompany || !newTitle) return;

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company: newCompany,
          title: newTitle,
          url: newUrl || null,
          hrEmail: newHrEmail || null,
          customContext: newContext || null,
          status: "SOURCED",
        }),
      });

      const data = await res.json();
      if (res.ok && data.job) {
        setJobs([data.job, ...jobs]);
        setIsAddModalOpen(false);
        setNewCompany("");
        setNewTitle("");
        setNewUrl("");
        setNewHrEmail("");
        setNewContext("");
        showToast(`Created lead for ${newCompany}`, "success");
      }
    } catch (err) {
      console.error("Failed to create lead:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredJobs = jobs.filter(
    (j) =>
      j.company.toLowerCase().includes(searchQuery.toLowerCase()) ||
      j.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex h-full flex-col bg-[#09090b] text-zinc-100 relative">
      {/* Sleek, Compact Header Bar (h-11) */}
      <header className="border-b border-zinc-800/70 bg-[#09090b]/90 backdrop-blur-md px-3 sm:px-4 py-2 sticky top-0 z-20 shrink-0">
        <div className="flex flex-wrap items-center justify-between gap-2">
          {/* Left: Compact Title & Status Pills */}
          <div className="flex items-center gap-2 min-w-0">
            <h1 className="text-xs sm:text-sm font-semibold text-white tracking-tight shrink-0">
              Pipeline
            </h1>

            {/* Total leads pill */}
            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-zinc-800/80 text-zinc-400 border border-zinc-700/40 shrink-0">
              {jobs.length} leads
            </span>

            {/* Mailbox Clean Status Indicator */}
            {isMailboxClean && (
              <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-medium shrink-0">
                <CheckCircle2 className="h-2.5 w-2.5 shrink-0" />
                <span>Mailbox Clean</span>
              </div>
            )}

            {/* Bounced Logged Ledger Trigger */}
            {allBouncedLogs.length > 0 && (
              <button
                onClick={() => setShowBouncedModal(true)}
                className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 text-zinc-300 text-[10px] font-medium transition-colors shrink-0"
                title="View bounced addresses saved permanently in DB"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                <span>{allBouncedLogs.length} Bounced</span>
              </button>
            )}

            {/* Auto-Sync Toggle */}
            <button
              onClick={() => setAutoSyncEnabled(!autoSyncEnabled)}
              title="Toggle background Gmail sync"
              className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] text-zinc-400 hover:text-zinc-200 transition-colors shrink-0"
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  autoSyncEnabled ? "bg-emerald-400 animate-pulse" : "bg-zinc-600"
                }`}
              />
              <span className="hidden md:inline">{autoSyncEnabled ? "Auto-Sync" : "Paused"}</span>
            </button>
          </div>

          {/* Right: Compact Search + Action Buttons */}
          <div className="flex items-center gap-1.5">
            {/* Search Filter */}
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-zinc-500" />
              <input
                type="text"
                placeholder="Filter leads..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-6.5 w-28 sm:w-36 md:w-44 focus:w-52 transition-all rounded-md border border-zinc-800 bg-zinc-900/90 pl-6 pr-2 text-[11px] text-zinc-200 placeholder:text-zinc-500 focus:border-indigo-500/50 focus:outline-none"
              />
            </div>

            {/* Sync Now Button */}
            <button
              onClick={() => handleScanInbox(false, true)}
              disabled={isScanning}
              className="flex h-6.5 items-center gap-1 rounded-md border border-zinc-800 bg-zinc-900/90 hover:bg-zinc-800 px-2 text-[11px] font-medium text-zinc-300 hover:text-white transition-colors disabled:opacity-50 whitespace-nowrap"
              title="Audit Gmail and realign pipeline"
            >
              <RefreshCw className={`h-2.5 w-2.5 ${isScanning ? "animate-spin text-indigo-400" : "text-zinc-400"}`} />
              <span className="hidden sm:inline">{isScanning ? "Checking..." : "Sync Mail"}</span>
            </button>

            {/* Add Lead Button */}
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="flex h-6.5 items-center gap-1 rounded-md bg-indigo-600 hover:bg-indigo-500 px-2.5 text-[11px] font-medium text-white transition-all shadow-sm whitespace-nowrap"
            >
              <Plus className="h-3 w-3" />
              <span>Add Lead</span>
            </button>
          </div>
        </div>
      </header>

      {/* Board Columns: High-Density & Compact */}
      <div className="flex-1 min-h-0 overflow-x-auto overflow-y-hidden px-3 py-2 sm:px-4 sm:py-2.5 custom-scrollbar">
        {isLoading ? (
          <div className="flex items-center justify-center h-48 text-xs text-zinc-500 gap-2">
            <Loader2 className="h-3.5 w-3.5 animate-spin text-indigo-400" /> Loading your pipeline...
          </div>
        ) : (
          <div className="flex gap-2.5 sm:gap-3 h-full min-w-max pb-1">
            {COLUMNS.map((col, colIdx) => {
              const columnJobs = filteredJobs.filter((j) => j.status === col.id);
              const isDropTarget = dragOverColId === col.id;

              return (
                <div
                  key={col.id}
                  className="flex w-[240px] sm:w-[252px] lg:w-[260px] shrink-0 flex-col h-full min-h-0"
                  onDragOver={(e) => handleDragOver(e, col.id)}
                  onDragLeave={(e) => handleDragLeave(e, col.id)}
                  onDrop={(e) => handleDrop(e, col.id)}
                >
                  {/* Column Header */}
                  <div className="flex items-center justify-between px-1 py-1 shrink-0">
                    <div className="flex items-center gap-1.5">
                      <span className={`h-1.5 w-1.5 rounded-full ${col.dotColor}`} />
                      <h3 className="text-[10px] font-semibold uppercase tracking-wider text-zinc-300">
                        {col.title}
                      </h3>
                      <span className="flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-zinc-800/80 px-1 text-[9px] font-semibold text-zinc-400 font-mono border border-zinc-700/40">
                        {columnJobs.length}
                      </span>
                    </div>

                    <span className="text-[9px] text-zinc-600 font-mono">
                      #{colIdx + 1}
                    </span>
                  </div>

                  {/* Cards Drop Container */}
                  <div
                    className={`flex-1 min-h-0 overflow-y-auto overscroll-contain custom-scrollbar flex flex-col gap-1.5 rounded-xl p-1.5 pb-4 border transition-all duration-150 ${
                      isDropTarget
                        ? "border-indigo-500/80 bg-indigo-950/20 ring-1 ring-indigo-500/30"
                        : "border-zinc-800/40 bg-[#0c0c0f]/60"
                    }`}
                  >
                    {/* Visual Drop Target Highlight when dragging */}
                    {isDropTarget && (
                      <div className="flex h-8 shrink-0 items-center justify-center rounded-lg border border-dashed border-indigo-400/60 bg-indigo-500/10 text-[11px] font-medium text-indigo-300 animate-pulse">
                        + Drop into {col.title}
                      </div>
                    )}

                    {columnJobs.length === 0 && !isDropTarget ? (
                      <div className="flex flex-1 min-h-[120px] flex-col items-center justify-center rounded-lg border border-dashed border-zinc-800/50 text-[10px] text-zinc-600 gap-0.5">
                        <span>No leads</span>
                        <span className="text-[9px] text-zinc-700">Drag card here</span>
                      </div>
                    ) : (
                      columnJobs.map((job) => {
                        const isBeingDragged = draggedJobId === job.id;
                        const avatarClass = getAvatarGradient(job.company);
                        const initialLetter = job.company.charAt(0).toUpperCase();

                        const activeLogs =
                          (job.outreachLogs as any[])?.filter(
                            (l: any) => l.status === "DELIVERED" || l.status === "SENT"
                          ) || [];
                        const bounces =
                          (job.outreachLogs as any[])?.filter((l: any) => l.status === "BOUNCED") || [];

                        return (
                          <div
                            key={job.id}
                            draggable={true}
                            onDragStart={(e) => handleDragStart(e, job.id)}
                            onDragEnd={handleDragEnd}
                            className={`group relative rounded-lg border p-2 sm:p-2.5 transition-all duration-150 cursor-grab active:cursor-grabbing select-none shadow-sm ${
                              isBeingDragged
                                ? "opacity-30 scale-95 border-indigo-500/60 bg-zinc-900/80"
                                : job.status === "BOUNCED"
                                ? "border-amber-500/25 bg-[#141210] hover:border-amber-500/40"
                                : "border-zinc-800/70 bg-[#121217] hover:bg-[#16161d] hover:border-zinc-700/80 hover:shadow-md"
                            }`}
                          >
                            {/* Card Top Row: Avatar + Name + Badges + Link */}
                            <div className="flex items-start justify-between gap-1">
                              <div className="flex items-center gap-1.5 min-w-0">
                                <GripVertical className="h-2.5 w-2.5 text-zinc-600 group-hover:text-zinc-400 shrink-0" />
                                <div
                                  className={`flex h-5 w-5 min-w-[20px] min-h-[20px] aspect-square shrink-0 items-center justify-center rounded bg-gradient-to-br border text-[9px] font-bold ${avatarClass}`}
                                >
                                  {initialLetter}
                                </div>
                                <h4 className="font-semibold text-[11px] text-zinc-100 group-hover:text-indigo-300 transition-colors truncate">
                                  {job.company}
                                </h4>
                              </div>

                              <div className="flex items-center gap-1 shrink-0">
                                {job.status === "BOUNCED" && (
                                  <span className="px-1 py-0.2 rounded bg-amber-500/10 text-amber-400 text-[8px] font-mono border border-amber-500/25">
                                    Bounced
                                  </span>
                                )}
                                {job.status === "REPLIED" && (
                                  <span className="px-1 py-0.2 rounded bg-sky-500/10 text-sky-400 text-[8px] font-mono border border-sky-500/25">
                                    Replied
                                  </span>
                                )}
                                {job.url && (
                                  <a
                                    href={job.url.startsWith("http") ? job.url : `https://${job.url}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    title="Open website"
                                    onClick={(e) => e.stopPropagation()}
                                    className="text-zinc-600 hover:text-zinc-300 p-0.5 transition-colors"
                                  >
                                    <ExternalLink className="h-2.5 w-2.5" />
                                  </a>
                                )}
                              </div>
                            </div>

                            {/* Job Title */}
                            <p className="text-[10px] text-zinc-400 mt-0.5 truncate pl-4">
                              {job.title}
                            </p>

                            {/* Inbound Recruiter Reply Preview (if replied) */}
                            {(job.status === "REPLIED" || (job as any).lastReplySnippet) && (
                              <div className="mt-1.5 rounded border border-sky-500/20 bg-sky-500/10 p-1.5 flex flex-col gap-0.5">
                                <div className="flex items-center justify-between text-sky-300 font-semibold text-[9px]">
                                  <span className="flex items-center gap-1">
                                    <Radio className="h-2 w-2 text-sky-400 animate-pulse" /> Replied
                                  </span>
                                  {(job as any).suggestedAiReply && (
                                    <span className="text-[8px] px-1 py-0.2 rounded bg-indigo-500/20 text-indigo-300 font-mono">
                                      AI Draft
                                    </span>
                                  )}
                                </div>
                                <p className="text-[9px] text-zinc-300 line-clamp-1 italic">
                                  &ldquo;{(job as any).lastReplySnippet || "Inbound response in Gmail"}&rdquo;
                                </p>
                              </div>
                            )}

                            {/* Compact Single Status Bar */}
                            {(job.status === "EMAILED" || activeLogs.length > 0 || bounces.length > 0) &&
                              job.status !== "REPLIED" && (
                                <div className="mt-1.5 flex items-center justify-between text-[9px] bg-zinc-900/80 border border-zinc-800/80 rounded px-1.5 py-0.5">
                                  <div className="flex items-center gap-1 overflow-hidden">
                                    {activeLogs.length > 0 && (
                                      <span className="flex items-center gap-1 text-emerald-400 font-medium shrink-0">
                                        <span className="h-1 w-1 rounded-full bg-emerald-400" />
                                        <span>
                                          {activeLogs.length > 1
                                            ? `${activeLogs.length} Active`
                                            : "Active"}
                                        </span>
                                      </span>
                                    )}
                                    {bounces.length > 0 && (
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setShowBouncedModal(true);
                                        }}
                                        className="flex items-center gap-0.5 text-amber-400/90 hover:text-amber-300 transition-colors ml-1 font-mono text-[8px]"
                                        title="Click to view bounced addresses"
                                      >
                                        <AlertTriangle className="h-2 w-2" />
                                        <span>{bounces.length} Bounced</span>
                                      </button>
                                    )}
                                  </div>
                                  <span className="text-[8px] text-zinc-500 font-mono shrink-0 ml-1">
                                    PDF ✓
                                  </span>
                                </div>
                              )}

                            {/* Card Footer: Clean HR email + Action Controls */}
                            <div className="mt-2 pt-1.5 border-t border-zinc-800/50 flex items-center justify-between">
                              <div className="text-[9px] text-zinc-500 truncate max-w-[85px]">
                                {job.hrEmail ? (
                                  <span className="text-zinc-400 font-mono truncate block" title={job.hrEmail}>
                                    {job.hrEmail}
                                  </span>
                                ) : (
                                  <span className="text-zinc-600 italic">No HR</span>
                                )}
                              </div>

                              <div className="flex items-center gap-0.5">
                                {/* 5 HR Contacts Drawer Trigger */}
                                <button
                                  onClick={() =>
                                    setSelectedJobForHrDrawer({
                                      id: job.id,
                                      company: job.company,
                                      title: job.title,
                                      url: job.url,
                                      hrEmail: job.hrEmail,
                                      status: job.status,
                                      generatedSubject: job.generatedSubject,
                                      generatedBody: job.generatedBody,
                                      hrContacts: job.hrContacts,
                                      outreachLogs: job.outreachLogs,
                                      lastReplySnippet: (job as any).lastReplySnippet,
                                      lastReplyFrom: (job as any).lastReplyFrom,
                                      lastReplySubject: (job as any).lastReplySubject,
                                      lastReplyAt: (job as any).lastReplyAt,
                                      suggestedAiReply: (job as any).suggestedAiReply,
                                    })
                                  }
                                  title="Find 5 HR contacts and apply"
                                  className="flex h-5 items-center gap-0.5 rounded bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/20 px-1 text-[9px] font-medium text-indigo-300 transition-colors"
                                >
                                  <Users className="h-2 w-2 text-indigo-400" /> 5 HR
                                </button>

                                {/* AI Research & Draft trigger */}
                                <button
                                  onClick={() => setSelectedJobForAi(job)}
                                  className="h-5 w-5 rounded bg-zinc-800/80 hover:bg-zinc-700 text-zinc-400 hover:text-white flex items-center justify-center transition-colors"
                                  title="Open AI Draft Studio"
                                >
                                  <Sparkles className="h-2.5 w-2.5 text-zinc-400" />
                                </button>

                                {/* Quick Stage Shift: Backward */}
                                {colIdx > 0 && (
                                  <button
                                    onClick={() => handleStepStatus(job.id, job.status, "prev")}
                                    title={`Move back to ${COLUMNS[colIdx - 1].title}`}
                                    className="h-5 w-4 flex items-center justify-center text-zinc-500 hover:text-white rounded hover:bg-zinc-800 transition-colors"
                                  >
                                    <ChevronLeft className="h-2.5 w-2.5" />
                                  </button>
                                )}

                                {/* Quick Stage Shift: Forward */}
                                {colIdx < COLUMNS.length - 1 && (
                                  <button
                                    onClick={() => handleStepStatus(job.id, job.status, "next")}
                                    title={`Move forward to ${COLUMNS[colIdx + 1].title}`}
                                    className="h-5 w-4 flex items-center justify-center text-zinc-500 hover:text-white rounded hover:bg-zinc-800 transition-colors"
                                  >
                                    <ChevronRight className="h-2.5 w-2.5" />
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 5-Contact HR Outreach Drawer */}
      {selectedJobForHrDrawer && (
        <HrOutreachDrawer
          job={selectedJobForHrDrawer}
          isOpen={!!selectedJobForHrDrawer}
          onClose={() => setSelectedJobForHrDrawer(null)}
          onJobUpdated={(updated) => {
            setJobs(jobs.map((j) => (j.id === updated.id ? { ...j, ...updated } : j)));
            setSelectedJobForHrDrawer(null);
          }}
        />
      )}

      {/* AI Draft Studio Modal */}
      {selectedJobForAi && (
        <AiDraftModal
          job={selectedJobForAi}
          isOpen={!!selectedJobForAi}
          onClose={() => setSelectedJobForAi(null)}
          onJobUpdated={(updated) => {
            setJobs(jobs.map((j) => (j.id === updated.id ? updated : j)));
            setSelectedJobForAi(null);
          }}
        />
      )}

      {/* Add Lead Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in">
          <div className="relative w-full max-w-md rounded-2xl border border-zinc-800 bg-[#101014] p-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-zinc-800/80 pb-2.5 mb-3.5">
              <h3 className="text-xs font-semibold text-white flex items-center gap-1.5">
                <Building className="h-3.5 w-3.5 text-indigo-400" /> Add New Job Lead
              </h3>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-zinc-400 hover:text-white p-1 rounded hover:bg-zinc-800"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            <form onSubmit={handleCreateLead} className="flex flex-col gap-2.5">
              <div>
                <label className="text-[10px] font-medium text-zinc-400 uppercase tracking-wider block mb-1">
                  Company Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Supabase, Stripe, Linear"
                  value={newCompany}
                  onChange={(e) => setNewCompany(e.target.value)}
                  className="w-full rounded-lg border border-zinc-800 bg-[#09090b] px-2.5 py-1.5 text-xs text-zinc-100 placeholder:text-zinc-600 focus:border-zinc-700 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-[10px] font-medium text-zinc-400 uppercase tracking-wider block mb-1">
                  Job Role / Title *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Systems Engineer, Security Researcher"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full rounded-lg border border-zinc-800 bg-[#09090b] px-2.5 py-1.5 text-xs text-zinc-100 placeholder:text-zinc-600 focus:border-zinc-700 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-medium text-zinc-400 uppercase tracking-wider block mb-1">
                    Company Website / URL
                  </label>
                  <input
                    type="text"
                    placeholder="https://..."
                    value={newUrl}
                    onChange={(e) => setNewUrl(e.target.value)}
                    className="w-full rounded-lg border border-zinc-800 bg-[#09090b] px-2.5 py-1.5 text-xs text-zinc-100 placeholder:text-zinc-600 focus:border-zinc-700 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-medium text-zinc-400 uppercase tracking-wider block mb-1">
                    Recipient Email
                  </label>
                  <input
                    type="email"
                    placeholder="recruiter@..."
                    value={newHrEmail}
                    onChange={(e) => setNewHrEmail(e.target.value)}
                    className="w-full rounded-lg border border-zinc-800 bg-[#09090b] px-2.5 py-1.5 text-xs text-zinc-100 placeholder:text-zinc-600 focus:border-zinc-700 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-medium text-zinc-400 uppercase tracking-wider block mb-1">
                  Custom Notes / Context
                </label>
                <textarea
                  rows={2}
                  placeholder="Optional context to help AI personalize research..."
                  value={newContext}
                  onChange={(e) => setNewContext(e.target.value)}
                  className="w-full rounded-lg border border-zinc-800 bg-[#09090b] p-2 text-xs text-zinc-100 placeholder:text-zinc-600 focus:border-zinc-700 focus:outline-none resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-800/80 mt-1">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="rounded px-2.5 py-1 text-xs font-medium text-zinc-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex items-center gap-1.5 rounded bg-indigo-600 hover:bg-indigo-500 px-3 py-1 text-xs font-semibold text-white transition-colors disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-3 w-3 animate-spin" /> Adding...
                    </>
                  ) : (
                    "Create Lead"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Bounced Inboxes & Clean Mailbox Ledger Modal */}
      {showBouncedModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-xl rounded-2xl border border-zinc-800 bg-[#121217] p-4 sm:p-5 shadow-2xl animate-in zoom-in-95">
            <div className="flex items-start justify-between border-b border-zinc-800/80 pb-2.5">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400">
                  <ShieldAlert className="h-3.5 w-3.5" />
                </div>
                <div>
                  <h3 className="text-xs font-semibold text-white flex items-center gap-1.5">
                    Bounced Inboxes Ledger
                    <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium">
                      Gmail Cleaned
                    </span>
                  </h3>
                  <p className="text-[10px] text-zinc-400 mt-0.5">
                    Delivery failure notices are removed from your Gmail inbox, while failed recipient addresses and rejection reasons are stored in your database.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowBouncedModal(false)}
                className="text-zinc-500 hover:text-white p-1 rounded hover:bg-zinc-800/60"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="my-2.5 max-h-[50vh] overflow-y-auto space-y-1.5 pr-1">
              {allBouncedLogs.length === 0 ? (
                <div className="text-center py-6 text-[11px] text-zinc-500">
                  No bounced emails detected. All outboxes are healthy!
                </div>
              ) : (
                allBouncedLogs.map((item) => (
                  <div
                    key={item.id}
                    className="p-2.5 rounded-lg border border-zinc-800 bg-zinc-900/60 flex items-start justify-between gap-2.5"
                  >
                    <div className="space-y-0.5 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-mono text-[11px] font-semibold text-amber-300">
                          {item.email}
                        </span>
                        <span className="text-[9px] px-1.5 py-0.2 rounded bg-zinc-800 text-zinc-300 border border-zinc-700 font-medium">
                          {item.company} • {item.title}
                        </span>
                      </div>
                      <p className="text-[10px] text-zinc-300">
                        <span className="text-zinc-500">Reason:</span> {item.reason}
                      </p>
                      <div className="flex items-center gap-1.5 text-[9px] text-zinc-400 pt-0.5">
                        <span className="flex items-center gap-0.5 text-emerald-400">
                          <Check className="h-2.5 w-2.5" /> Cleaned from Gmail
                        </span>
                        <span>•</span>
                        <span className="text-indigo-300 font-mono">
                          Saved in DB ({new Date(item.sentAt).toLocaleDateString()})
                        </span>
                      </div>
                    </div>

                    <button
                      onClick={() => {
                        const targetJob = jobs.find((j) => j.id === item.jobId);
                        if (targetJob) {
                          setShowBouncedModal(false);
                          setSelectedJobForHrDrawer({
                            id: targetJob.id,
                            company: targetJob.company,
                            title: targetJob.title,
                            url: targetJob.url,
                            hrEmail: targetJob.hrEmail,
                            hrName: targetJob.hrName,
                            hrContacts: (targetJob as any).hrContacts,
                            generatedSubject: targetJob.generatedSubject,
                            generatedBody: targetJob.generatedBody,
                            status: targetJob.status,
                            outreachLogs: (targetJob as any).outreachLogs,
                          });
                        }
                      }}
                      className="shrink-0 flex items-center gap-1 text-[10px] px-2 py-1 rounded border border-indigo-500/30 bg-indigo-500/10 text-indigo-300 hover:bg-indigo-500/20 transition-colors font-medium"
                    >
                      <span>Route Alt</span>
                      <ArrowUpRight className="h-2.5 w-2.5" />
                    </button>
                  </div>
                ))
              )}
            </div>

            <div className="pt-2 border-t border-zinc-800/80 flex items-center justify-between">
              <span className="text-[10px] text-zinc-400">
                Total Bounced Tracked: <strong className="text-white">{allBouncedLogs.length}</strong>
              </span>
              <button
                onClick={() => setShowBouncedModal(false)}
                className="px-3 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-[10px] font-semibold text-white transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
