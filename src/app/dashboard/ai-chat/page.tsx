"use client";

import { useState, useEffect } from "react";
import {
  Sparkles,
  Bot,
  User,
  Briefcase,
  AlertTriangle,
  Mail,
  CheckCircle2,
  Radio,
  MapPin,
  TrendingUp,
  RefreshCw,
  Search,
  ExternalLink,
  PanelRightOpen,
  PanelRightClose,
  X,
  Zap,
} from "lucide-react";
import AiCopilotChat from "@/components/AiCopilotChat";

interface ContextData {
  profile: {
    fullName: string;
    headline: string;
    skills: string[];
    targetRoles: string[];
    preferredLocations: string[];
    remotePreference: string;
  };
  metrics: {
    totalLeads: number;
    sourcedCount: number;
    emailedCount: number;
    repliedCount: number;
    interviewingCount: number;
    bouncedCount: number;
  };
  bouncedLeads: Array<{
    jobId: string;
    company: string;
    title: string;
    bouncedEmails: string[];
  }>;
  repliedLeads: Array<{
    jobId: string;
    company: string;
    title: string;
    lastReplySnippet: string;
  }>;
}

export default function AiChatPage() {
  const [context, setContext] = useState<ContextData | null>(null);
  const [activePrompt, setActivePrompt] = useState<string>("");
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    fetchContext();
  }, [refreshTrigger]);

  const fetchContext = async () => {
    try {
      const res = await fetch("/api/ai/chat");
      const data = await res.json();
      if (data.context) {
        setContext(data.context);
      }
    } catch (err) {
      console.error("Failed to load context:", err);
    }
  };

  return (
    <div className="flex h-full w-full bg-[#09090b] text-zinc-100 overflow-hidden relative">
      {/* Main Full-Width Dominant Chat Area */}
      <main className="flex-1 flex flex-col h-full min-w-0 bg-[#09090b]">
        {/* Top Context Quick-Status Strip - Compact */}
        <div className="bg-[#0b0b0f] border-b border-zinc-800/60 px-3 sm:px-4 py-1 flex items-center justify-between gap-2 overflow-x-auto shrink-0 select-none text-xs">
          <div className="flex items-center gap-2 shrink-0">
            <div className="flex items-center gap-1.5 text-zinc-300 font-medium text-[11px]">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              <span>{context?.profile?.fullName || "Khawar Ahemad Khan"}</span>
            </div>

            <span className="text-zinc-700 hidden sm:inline">•</span>

            {/* Target Role Pill */}
            <span className="text-[10px] text-zinc-400 truncate max-w-[160px] hidden sm:inline">
              {context?.profile?.targetRoles?.[0] || "Systems Engineer"}
            </span>

            {/* Quick Metrics Badges */}
            <div className="flex items-center gap-1 ml-1">
              <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-zinc-800/80 text-zinc-300 border border-zinc-700/50">
                {context?.metrics?.totalLeads ?? 0} Leads
              </span>

              <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-indigo-500/10 text-indigo-300 border border-indigo-500/30">
                {context?.metrics?.emailedCount ?? 0} Dispatched
              </span>

              {context?.bouncedLeads && context.bouncedLeads.length > 0 && (
                <button
                  onClick={() => setActivePrompt("Fix my bounced emails and find verified recruiters")}
                  className="flex items-center gap-0.5 text-[9px] font-mono px-1.5 py-0.2 rounded bg-amber-500/10 text-amber-400 border border-amber-500/30 hover:bg-amber-500/20 transition-colors"
                  title="Click to have AI resolve bounced leads"
                >
                  <AlertTriangle className="h-2 w-2" />
                  <span>{context.bouncedLeads.length} Bounced</span>
                </button>
              )}

              {context?.repliedLeads && context.repliedLeads.length > 0 && (
                <button
                  onClick={() => setActivePrompt(`Draft reply to recruiter at ${context.repliedLeads[0].company}`)}
                  className="flex items-center gap-0.5 text-[9px] font-mono px-1.5 py-0.2 rounded bg-sky-500/10 text-sky-400 border border-sky-500/30 hover:bg-sky-500/20 transition-colors"
                  title="Click to draft reply for recruiter response"
                >
                  <Radio className="h-2 w-2 animate-pulse" />
                  <span>{context.repliedLeads.length} Reply</span>
                </button>
              )}
            </div>
          </div>

          {/* Right: Toggle Context Drawer Button */}
          <button
            onClick={() => setIsDrawerOpen(!isDrawerOpen)}
            className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-800 text-[10px] font-medium transition-colors shrink-0"
          >
            {isDrawerOpen ? <PanelRightClose className="h-3 w-3" /> : <PanelRightOpen className="h-3 w-3" />}
            <span className="hidden sm:inline">{isDrawerOpen ? "Hide Drawer" : "Profile & Stats"}</span>
          </button>
        </div>

        {/* Big Spacious Chat Component */}
        <div className="flex-1 min-h-0 w-full">
          <AiCopilotChat
            key={activePrompt}
            initialPrompt={activePrompt}
            onActionComplete={() => setRefreshTrigger((prev) => prev + 1)}
          />
        </div>
      </main>

      {/* Slide-out Candidate Insights & Strategy Drawer (Non-Intrusive) */}
      {isDrawerOpen && (
        <aside className="w-80 border-l border-zinc-800/80 bg-[#0c0c10] flex flex-col justify-between shrink-0 h-full overflow-y-auto custom-scrollbar p-4 space-y-4 shadow-2xl z-30 animate-in slide-in-from-right duration-200">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-2.5">
            <span className="text-xs font-semibold text-white flex items-center gap-1.5">
              <Zap className="h-3.5 w-3.5 text-indigo-400" /> Candidate Context & Tools
            </span>
            <button
              onClick={() => setIsDrawerOpen(false)}
              className="p-1 rounded text-zinc-400 hover:text-white hover:bg-zinc-800"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Candidate Profile Details */}
          <div className="space-y-3">
            <div className="rounded-xl border border-zinc-800/80 bg-[#121217] p-3 shadow-sm">
              <h3 className="text-xs font-semibold text-white">
                {context?.profile?.fullName || "Khawar Ahemad Khan"}
              </h3>
              <p className="text-[11px] text-zinc-400 mt-0.5">
                {context?.profile?.headline || "Systems & Security Engineer"}
              </p>

              <div className="mt-2 text-[11px] text-zinc-300">
                <span className="text-zinc-500 block text-[9px] uppercase font-semibold">Target Roles:</span>
                <p>{context?.profile?.targetRoles?.join(", ") || "Systems Engineer"}</p>
              </div>

              <div className="mt-2 text-[11px] text-zinc-300">
                <span className="text-zinc-500 block text-[9px] uppercase font-semibold">Preferences:</span>
                <p>{context?.profile?.remotePreference || "Remote"} ({context?.profile?.preferredLocations?.join(", ") || "Global"})</p>
              </div>

              <div className="mt-2.5 pt-2 border-t border-zinc-800/60">
                <span className="text-zinc-500 block text-[9px] uppercase font-semibold mb-1">
                  Skills ({context?.profile?.skills?.length || 0}):
                </span>
                <div className="flex flex-wrap gap-1">
                  {context?.profile?.skills?.map((skill, i) => (
                    <span
                      key={i}
                      className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-zinc-800 text-zinc-300 border border-zinc-700/50"
                    >
                      {skill}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Pipeline Stats Breakdown */}
          <div className="space-y-2">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
              Pipeline Stages
            </span>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-lg border border-zinc-800/80 bg-[#121217] p-2">
                <span className="text-[10px] text-zinc-500 block">Sourced Leads</span>
                <span className="text-base font-bold text-white">
                  {context?.metrics?.sourcedCount ?? 0}
                </span>
              </div>

              <div className="rounded-lg border border-zinc-800/80 bg-[#121217] p-2">
                <span className="text-[10px] text-zinc-500 block">Outreach Sent</span>
                <span className="text-base font-bold text-indigo-400">
                  {context?.metrics?.emailedCount ?? 0}
                </span>
              </div>

              <div className="rounded-lg border border-zinc-800/80 bg-[#121217] p-2">
                <span className="text-[10px] text-zinc-500 block">Bounced Inboxes</span>
                <span className="text-base font-bold text-amber-400">
                  {context?.metrics?.bouncedCount ?? 0}
                </span>
              </div>

              <div className="rounded-lg border border-zinc-800/80 bg-[#121217] p-2">
                <span className="text-[10px] text-zinc-500 block">Interview Loops</span>
                <span className="text-base font-bold text-emerald-400">
                  {context?.metrics?.interviewingCount ?? 0}
                </span>
              </div>
            </div>
          </div>

          {/* Quick Action Plan Launchers */}
          <div className="space-y-2 pt-2 border-t border-zinc-800">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 block">
              Quick AI Triggers
            </span>

            <button
              onClick={() => {
                setActivePrompt("Build a personalized job search strategy plan for me");
                setIsDrawerOpen(false);
              }}
              className="w-full text-left p-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-xs text-zinc-200 transition-colors flex items-center justify-between"
            >
              <span>📋 Create 4-Step Action Plan</span>
              <span className="text-indigo-400">&rarr;</span>
            </button>

            <button
              onClick={() => {
                setActivePrompt("Fix my bounced emails and find verified recruiters");
                setIsDrawerOpen(false);
              }}
              className="w-full text-left p-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-xs text-amber-300 transition-colors flex items-center justify-between"
            >
              <span>⚠️ Resolve 6 Bounced Leads</span>
              <span className="text-amber-400">&rarr;</span>
            </button>

            <button
              onClick={() => {
                setActivePrompt("Find 10 remote systems engineer jobs");
                setIsDrawerOpen(false);
              }}
              className="w-full text-left p-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-xs text-indigo-300 transition-colors flex items-center justify-between"
            >
              <span>🔍 Discover 10 Scored Roles</span>
              <span className="text-indigo-400">&rarr;</span>
            </button>
          </div>
        </aside>
      )}
    </div>
  );
}
