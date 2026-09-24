"use client";

import { useState, useEffect, useRef } from "react";
import {
  Sparkles,
  Send,
  Loader2,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Mail,
  Briefcase,
  RefreshCw,
  X,
  ExternalLink,
  ChevronRight,
  User,
  Bot,
  ArrowRight,
  ShieldCheck,
  Check,
  Compass,
  FileText,
  Search,
  MessageSquare,
  Zap,
} from "lucide-react";
import { useToast } from "@/components/ToastProvider";

export interface ChatSession {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  _count?: { messages: number };
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  sessionId?: string | null;
  actionPayload?: {
    id?: string;
    type: string;
    title: string;
    description: string;
    status: "PENDING" | "APPROVED" | "EXECUTED" | "DISMISSED";
    payload: any;
    result?: any;
  } | null;
  createdAt?: string | Date;
}

interface AiCopilotChatProps {
  initialPrompt?: string;
  onActionComplete?: () => void;
  compact?: boolean;
}

const DEFAULT_WELCOME: ChatMessage = {
  id: "welcome-1",
  role: "assistant",
  content: `👋 Hello! I am your **JobOps AI Career Copilot**. I have full real-time access to your candidate profile, resume skills, and active pipeline leads.\n\n### 🛠️ What I can do for you:\n• 🔍 **Multi-Platform Job Crawl**: Find scored tech jobs across LinkedIn, RemoteOK, and Arbeitnow\n• 📋 **Career Strategy & Planning**: Build custom roadmaps and target company lists\n• 📄 **Resume Review**: Analyze CV, highlight strengths, and recommend quantifiable improvements\n• ⚠️ **Bounce Diagnostics**: Replace failed emails with verified recruiters\n• 📬 **Inbound Recruiter Reply**: Draft interview availability responses for your approval\n• ✨ **Hyper-Personalized Cold Outreach**: Pitch your specific projects with resume attached\n• 🔄 **Gmail Mailbox Audit**: Reconcile pipeline cards and purge bounce notices from your inbox\n\nAsk me anything, or pick one of the quick tools below!`,
};

export default function AiCopilotChat({
  initialPrompt,
  onActionComplete,
  compact = false,
}: AiCopilotChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([DEFAULT_WELCOME]);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const activeSessionIdRef = useRef<string | null>(null);
  const messagesCacheRef = useRef<Record<string, ChatMessage[]>>({});
  const [activeSessionTitle, setActiveSessionTitle] = useState<string>("Career Strategy & Copilot");
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [inputValue, setInputValue] = useState(initialPrompt || "");
  const [isLoading, setIsLoading] = useState(false);
  const [executingActionId, setExecutingActionId] = useState<string | null>(null);
  const [editActionPayload, setEditActionPayload] = useState<any | null>(null);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const { addToast } = useToast();

  const setAndTrackSession = (id: string | null, title?: string) => {
    activeSessionIdRef.current = id;
    setActiveSessionId(id);
    if (title) setActiveSessionTitle(title);
  };

  const updateMessagesState = (newMsgs: ChatMessage[] | ((prev: ChatMessage[]) => ChatMessage[])) => {
    setMessages((prev) => {
      const resolved = typeof newMsgs === "function" ? newMsgs(prev) : newMsgs;
      if (activeSessionIdRef.current) {
        messagesCacheRef.current[activeSessionIdRef.current] = resolved;
      }
      return resolved;
    });
  };

  useEffect(() => {
    initChat();
  }, []);

  useEffect(() => {
    if (initialPrompt) {
      setInputValue(initialPrompt);
      handleSendMessage(initialPrompt);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialPrompt]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  // Auto-resize textarea as text grows
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 160)}px`;
    }
  }, [inputValue]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const initChat = async () => {
    try {
      const res = await fetch("/api/ai/chat/sessions");
      const data = await res.json();
      if (data.sessions && Array.isArray(data.sessions) && data.sessions.length > 0) {
        setSessions(data.sessions);
        const targetSession = data.sessions[0];
        setAndTrackSession(targetSession.id, targetSession.title);
        await fetchChatHistory(targetSession.id, false);
      } else {
        const chatRes = await fetch("/api/ai/chat");
        const chatData = await chatRes.json();
        if (chatData?.sessionId) {
          setAndTrackSession(chatData.sessionId, chatData.sessionTitle);
          if (chatData.messages && chatData.messages.length > 0) {
            updateMessagesState(chatData.messages);
          }
        }
      }
    } catch (err) {
      console.error("Failed to initialize chat:", err);
    }
  };

  const refreshSessionsListOnly = async () => {
    try {
      const res = await fetch("/api/ai/chat/sessions");
      const data = await res.json();
      if (data.sessions && Array.isArray(data.sessions)) {
        setSessions(data.sessions);
      }
    } catch (err) {
      console.error("Failed to refresh sessions list:", err);
    }
  };

  const fetchChatHistory = async (sessionId: string, useCacheFirst = true) => {
    try {
      // 1. Instant 0ms cache rendering if available
      if (useCacheFirst && messagesCacheRef.current[sessionId]?.length) {
        setMessages(messagesCacheRef.current[sessionId]);
      }

      const url = `/api/ai/chat?sessionId=${sessionId}`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.sessionId) {
        setAndTrackSession(data.sessionId, data.sessionTitle);
      }
      if (data.messages && Array.isArray(data.messages)) {
        if (data.messages.length === 0) {
          updateMessagesState([DEFAULT_WELCOME]);
        } else {
          updateMessagesState(data.messages);
        }
      }
    } catch (err) {
      console.error("Failed to load chat history:", err);
    }
  };

  const handleNewChat = async () => {
    try {
      const res = await fetch("/api/ai/chat/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "New Conversation" }),
      });
      const data = await res.json();
      if (data.session) {
        setSessions((prev) => [data.session, ...prev.filter((s) => s.id !== data.session.id)]);
        setAndTrackSession(data.session.id, data.session.title);
        const welcomeMsg: ChatMessage[] = [
          {
            id: `welcome-${Date.now()}`,
            role: "assistant",
            content: `👋 New conversation started. How can I assist with your job search, cold outreach, resume, or recruiter responses today?`,
          },
        ];
        updateMessagesState(welcomeMsg);
        setIsHistoryOpen(false);
        addToast({ message: "Started new chat session", type: "info" });
      }
    } catch (err) {
      console.error("Failed to create new chat session:", err);
    }
  };

  const handleSelectSession = (sessionId: string) => {
    if (sessionId === activeSessionIdRef.current) {
      setIsHistoryOpen(false);
      return;
    }
    const target = sessions.find((s) => s.id === sessionId);
    setAndTrackSession(sessionId, target?.title);
    fetchChatHistory(sessionId, true);
    setIsHistoryOpen(false);
  };

  const handleDeleteSession = async (e: React.MouseEvent, sessionId: string) => {
    e.stopPropagation();
    if (!confirm("Delete this conversation?")) return;
    try {
      await fetch(`/api/ai/chat/sessions?id=${sessionId}`, { method: "DELETE" });
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
      if (activeSessionIdRef.current === sessionId) {
        const remaining = sessions.filter((s) => s.id !== sessionId);
        if (remaining.length > 0) {
          handleSelectSession(remaining[0].id);
        } else {
          handleNewChat();
        }
      }
      addToast({ message: "Conversation deleted", type: "info" });
    } catch (err) {
      console.error("Delete session error:", err);
    }
  };

  const handleSendMessage = async (textToSend = inputValue) => {
    const trimmed = textToSend.trim();
    if (!trimmed || isLoading) return;

    const currentSessionId = activeSessionIdRef.current;
    const tempUserMsg: ChatMessage = {
      id: `temp-${Date.now()}`,
      role: "user",
      content: trimmed,
      sessionId: currentSessionId,
      createdAt: new Date().toISOString(),
    };

    updateMessagesState((prev) => [...prev, tempUserMsg]);
    setInputValue("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
    setIsLoading(true);

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: trimmed, sessionId: currentSessionId }),
      });

      const data = await res.json();
      if (res.ok && data.assistantMessage) {
        if (data.sessionId && data.sessionId !== activeSessionIdRef.current) {
          setAndTrackSession(data.sessionId);
        }
        if (data.sessionTitle) {
          setActiveSessionTitle(data.sessionTitle);
          setSessions((prev) =>
            prev.map((s) => (s.id === data.sessionId ? { ...s, title: data.sessionTitle } : s))
          );
        }
        updateMessagesState((prev) => [
          ...prev.filter((m) => m.id !== tempUserMsg.id),
          data.userMessage,
          data.assistantMessage,
        ]);
        // Silently refresh sessions list to show updated counts/timestamps
        refreshSessionsListOnly();
        if (onActionComplete) onActionComplete();
      } else {
        throw new Error(data.error || "Failed to process response");
      }
    } catch (err: unknown) {
      updateMessagesState((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: "assistant",
          content: `⚠️ Sorry, I encountered an issue: ${(err as Error).message}. Please try again.`,
        },
      ]);
    } finally {
      setIsLoading(false);
      setTimeout(() => textareaRef.current?.focus(), 100);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleClearHistory = async () => {
    if (!confirm("Clear current conversation history?")) return;
    try {
      const currentSessionId = activeSessionIdRef.current;
      await fetch(currentSessionId ? `/api/ai/chat?sessionId=${currentSessionId}` : "/api/ai/chat", {
        method: "DELETE",
      });
      updateMessagesState([
        {
          id: `welcome-${Date.now()}`,
          role: "assistant",
          content: `Conversation cleared. How can I assist with your job search, outreach, or career strategy today?`,
        },
      ]);
      refreshSessionsListOnly();
      addToast({ message: "Conversation cleared", type: "info" });
    } catch (err) {
      console.error("Failed to clear chat:", err);
    }
  };

  const handleApproveAction = async (msg: ChatMessage, customPayload?: any) => {
    if (!msg.actionPayload) return;
    const actionId = msg.actionPayload.id || msg.id;
    setExecutingActionId(actionId);

    try {
      const res = await fetch("/api/ai/chat/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messageId: msg.id,
          sessionId: activeSessionIdRef.current,
          actionId,
          type: msg.actionPayload.type,
          payload: customPayload || msg.actionPayload.payload,
          approved: true,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        updateMessagesState((prev) => {
          const updated = prev.map((m) =>
            m.id === msg.id
              ? {
                  ...m,
                  actionPayload: {
                    ...m.actionPayload!,
                    status: "EXECUTED" as const,
                    result: data.result,
                  },
                }
              : m
          );
          if (data.confirmationMessage) {
            return [...updated, data.confirmationMessage];
          }
          return updated;
        });

        addToast({ message: data.result?.message || "Action executed successfully!", type: "success" });
        refreshSessionsListOnly();
        if (onActionComplete) onActionComplete();
      } else {
        throw new Error(data.error || "Failed to execute action");
      }
    } catch (err: unknown) {
      addToast({ message: (err as Error).message, type: "info" });
    } finally {
      setExecutingActionId(null);
      setEditActionPayload(null);
      setEditingMessageId(null);
    }
  };

  const handleDismissAction = async (msg: ChatMessage) => {
    if (!msg.actionPayload) return;
    try {
      await fetch("/api/ai/chat/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messageId: msg.id,
          type: msg.actionPayload.type,
          payload: msg.actionPayload.payload,
          approved: false,
        }),
      });

      setMessages((prev) =>
        prev.map((m) =>
          m.id === msg.id
            ? {
                ...m,
                actionPayload: {
                  ...m.actionPayload!,
                  status: "DISMISSED",
                },
              }
            : m
        )
      );
      addToast({ message: "Action dismissed", type: "info" });
    } catch (err) {
      console.error("Dismiss action error:", err);
    }
  };

  const toolShortcuts = [
    { label: "Search 10 Jobs", icon: Search, prompt: "Find 10 remote systems engineer jobs" },
    { label: "Career Action Plan", icon: Compass, prompt: "Build a personalized job search strategy plan for me" },
    { label: "Fix Bounced Leads", icon: AlertTriangle, prompt: "Fix my bounced emails and find verified replacement recruiters" },
    { label: "Recruiter Reply Copilot", icon: MessageSquare, prompt: "Draft reply for inbound recruiter responses" },
    { label: "Draft Cold Outreach", icon: Sparkles, prompt: "Draft tailored cold outreach email for my top lead with resume attached" },
    { label: "Clean & Sync Mailbox", icon: RefreshCw, prompt: "Sync Gmail and clean mailbox" },
  ];

  return (
    <div className="flex flex-col h-full w-full bg-[#09090b] text-zinc-100 relative overflow-hidden">
      {/* Top Copilot Bar - Sleek & Compact with New Chat & History */}
      <div className="flex items-center justify-between px-3 sm:px-4 py-1.5 border-b border-zinc-800/80 bg-[#0c0c10]/95 backdrop-blur-md shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-gradient-to-tr from-indigo-500 to-violet-600 text-white shadow-sm shrink-0">
            <Zap className="h-3 w-3 fill-current" />
          </div>
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-xs font-semibold text-white tracking-tight shrink-0">
              AI Copilot
            </span>
            <span className="text-zinc-600 hidden sm:inline">•</span>
            {/* Active Session Title Pill */}
            <span className="text-[11px] text-zinc-300 font-medium truncate max-w-[150px] sm:max-w-[200px] hidden sm:inline">
              {activeSessionTitle}
            </span>
            <span className="px-1.5 py-0.2 rounded text-[9px] font-mono bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 flex items-center gap-1 shrink-0">
              <Sparkles className="h-2 w-2" />
              NVIDIA NIM
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {/* + New Chat Button */}
          <button
            onClick={handleNewChat}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-semibold shadow-sm transition-all hover:scale-[1.02] active:scale-[0.98]"
            title="Start New Chat"
          >
            <span className="text-xs leading-none">+</span>
            <span>New Chat</span>
          </button>

          {/* History Drawer Toggle */}
          <button
            onClick={() => setIsHistoryOpen(!isHistoryOpen)}
            className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium border transition-colors ${
              isHistoryOpen
                ? "bg-zinc-800 text-white border-zinc-700"
                : "bg-zinc-900/80 text-zinc-300 hover:text-white border-zinc-800 hover:bg-zinc-800"
            }`}
            title="View Chat History"
          >
            <MessageSquare className="h-3 w-3 text-indigo-400" />
            <span className="hidden sm:inline">History</span>
            {sessions.length > 0 && (
              <span className="text-[9px] font-mono px-1 rounded bg-zinc-800 text-zinc-400">
                {sessions.length}
              </span>
            )}
          </button>

          <button
            onClick={handleClearHistory}
            className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/80 border border-zinc-800 transition-colors"
            title="Clear Current Conversation"
          >
            <Trash2 className="h-2.5 w-2.5" />
          </button>
        </div>
      </div>

      {/* History Slide-Over Drawer */}
      {isHistoryOpen && (
        <div className="absolute inset-0 z-40 flex animate-in fade-in duration-150">
          {/* Subtle click-outside backdrop without aggressive blur */}
          <div
            onClick={() => setIsHistoryOpen(false)}
            className="fixed inset-0 bg-black/40"
          />

          {/* Drawer Sidebar */}
          <div className="relative z-50 w-72 max-w-[85vw] h-full bg-[#0e0e13] border-r border-zinc-800 shadow-2xl flex flex-col">
            {/* Drawer Header */}
            <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-zinc-800">
              <div className="flex items-center gap-2">
                <MessageSquare className="h-3.5 w-3.5 text-indigo-400" />
                <h3 className="text-xs font-semibold text-white">Chat History</h3>
              </div>
              <button
                onClick={() => setIsHistoryOpen(false)}
                className="text-zinc-400 hover:text-white p-1 rounded-md hover:bg-zinc-800 text-xs"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* + New Chat CTA inside Drawer */}
            <div className="p-2.5 border-b border-zinc-800/60">
              <button
                onClick={handleNewChat}
                className="w-full flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-sm transition-all hover:scale-[1.01]"
              >
                <span>+ Start New Chat</span>
              </button>
            </div>

            {/* Session List */}
            <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
              {sessions.length === 0 ? (
                <div className="text-center py-6 text-[11px] text-zinc-500">
                  No previous conversations
                </div>
              ) : (
                sessions.map((session) => {
                  const isActive = session.id === activeSessionId;
                  return (
                    <div
                      key={session.id}
                      onClick={() => handleSelectSession(session.id)}
                      className={`group relative flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg text-xs cursor-pointer border transition-all ${
                        isActive
                          ? "bg-indigo-600/15 border-indigo-500/40 text-white font-medium"
                          : "bg-zinc-900/40 border-transparent hover:border-zinc-800 hover:bg-zinc-800/60 text-zinc-300 hover:text-white"
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-xs">{session.title}</div>
                        <div className="text-[9px] text-zinc-500 font-mono mt-0.5">
                          {new Date(session.updatedAt || session.createdAt).toLocaleDateString(undefined, {
                            month: "short",
                            day: "numeric",
                          })}
                        </div>
                      </div>

                      {/* Delete Session Button */}
                      <button
                        onClick={(e) => handleDeleteSession(e, session.id)}
                        className="opacity-0 group-hover:opacity-100 hover:text-rose-400 p-1 text-zinc-500 transition-opacity"
                        title="Delete Chat"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* Main Messages Thread - Compact & Centered */}
      <div className="flex-1 min-h-0 overflow-y-auto px-3 sm:px-4 py-3 custom-scrollbar">
        <div className="max-w-2xl mx-auto w-full space-y-3">
          {messages.map((msg) => {
            const isUser = msg.role === "user";
            const action = msg.actionPayload;

            return (
              <div
                key={msg.id}
                className={`flex flex-col gap-1 ${
                  isUser ? "ml-auto items-end max-w-[85%]" : "mr-auto items-start w-full"
                }`}
              >
                {/* Sender Avatar & Name */}
                <div className="flex items-center gap-1 text-[9px] text-zinc-500 px-0.5">
                  {isUser ? (
                    <>
                      <span>You</span>
                      <div className="h-3.5 w-3.5 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-[8px] text-zinc-300">
                        <User className="h-2 w-2" />
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="h-3.5 w-3.5 rounded-full bg-indigo-600/30 border border-indigo-500/30 flex items-center justify-center text-[8px] text-indigo-300">
                        <Bot className="h-2 w-2" />
                      </div>
                      <span className="font-semibold text-indigo-300">Copilot</span>
                    </>
                  )}
                </div>

                {/* Message Bubble */}
                <div
                  className={`rounded-xl px-3 py-2 text-xs leading-relaxed ${
                    isUser
                      ? "bg-indigo-600 text-white rounded-br-xs shadow-sm"
                      : "bg-[#121218] border border-zinc-800/80 text-zinc-200 rounded-bl-xs w-full shadow-sm"
                  }`}
                >
                  <div className="whitespace-pre-wrap space-y-1 font-sans">
                    {renderFormattedText(msg.content)}
                  </div>
                </div>

                {/* Action Approval Card - Compact */}
                {action && (
                  <div className="w-full mt-1 rounded-xl border border-indigo-500/40 bg-[#101016] p-3 shadow-lg ring-1 ring-indigo-500/20">
                    {/* Card Header */}
                    <div className="flex items-center justify-between gap-2 border-b border-zinc-800/80 pb-2 mb-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="h-6 w-6 rounded-lg bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 flex items-center justify-center shrink-0">
                          {getActionIcon(action.type)}
                        </div>
                        <div className="min-w-0">
                          <span className="text-[9px] font-mono uppercase tracking-wider text-indigo-400 font-bold block">
                            {action.type.replace(/_/g, " ")}
                          </span>
                          <h4 className="text-xs font-semibold text-white truncate">
                            {action.title}
                          </h4>
                        </div>
                      </div>

                      <div>
                        {action.status === "EXECUTED" ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 text-[9px] font-semibold text-emerald-400">
                            <CheckCircle2 className="h-2.5 w-2.5" /> Executed
                          </span>
                        ) : action.status === "DISMISSED" ? (
                          <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-[9px] font-medium text-zinc-400">
                            Dismissed
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 text-[9px] font-semibold text-amber-400">
                            <ShieldCheck className="h-3 w-3" /> Approval Required
                          </span>
                        )}
                      </div>
                    </div>

                    <p className="text-[11px] text-zinc-400 mb-2 leading-relaxed">
                      {action.description}
                    </p>

                    {/* Action Preview */}
                    {renderActionPreview(action)}

                    {/* Action Execution Controls */}
                    {action.status === "PENDING" && (
                      <div className="mt-2.5 pt-2 border-t border-zinc-800/80 flex items-center justify-between gap-2">
                        <button
                          onClick={() => handleDismissAction(msg)}
                          className="px-2.5 py-1 text-[11px] font-medium text-zinc-400 hover:text-zinc-200 transition-colors"
                        >
                          Dismiss
                        </button>

                        <div className="flex items-center gap-1.5">
                          {(action.type === "SEND_OUTREACH" || action.type === "SEND_REPLY") && (
                            <button
                              onClick={() => {
                                setEditingMessageId(msg.id);
                                setEditActionPayload({ ...action.payload });
                              }}
                              className="px-2.5 py-1 rounded-md border border-zinc-700 bg-zinc-800 hover:bg-zinc-700 text-[11px] font-medium text-zinc-200 transition-colors"
                            >
                              Edit Draft
                            </button>
                          )}

                          <button
                            onClick={() => handleApproveAction(msg)}
                            disabled={executingActionId === (action.id || msg.id)}
                            className="flex items-center gap-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 px-3 py-1 text-[11px] font-semibold text-white shadow-sm transition-all disabled:opacity-50"
                          >
                            {executingActionId === (action.id || msg.id) ? (
                              <>
                                <Loader2 className="h-3 w-3 animate-spin" /> Executing...
                              </>
                            ) : (
                              <>
                                <Check className="h-3 w-3" /> Approve & Execute
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {isLoading && (
            <div className="flex items-center gap-2 text-[11px] text-zinc-400 bg-[#121218] border border-zinc-800/80 rounded-xl px-3 py-2 w-max shadow-sm">
              <Loader2 className="h-3 w-3 animate-spin text-indigo-400" />
              <span>Analyzing profile, pipeline & tools...</span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Modern Multi-Tool Quick Bar - Wrapped & Zero Horizontal Scroll */}
      <div className="border-t border-zinc-800/60 bg-[#0c0c10]/90 px-3 sm:px-4 py-1.5 shrink-0 overflow-x-hidden">
        <div className="max-w-2xl mx-auto flex flex-wrap items-center justify-center sm:justify-start gap-1 select-none">
          {toolShortcuts.map((tool, idx) => (
            <button
              key={idx}
              onClick={() => handleSendMessage(tool.prompt)}
              disabled={isLoading}
              className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-zinc-900/90 border border-zinc-800 hover:border-indigo-500/40 hover:bg-zinc-800 text-zinc-300 hover:text-white text-[10px] font-medium whitespace-nowrap transition-all disabled:opacity-50"
            >
              <tool.icon className="h-2.5 w-2.5 text-indigo-400 shrink-0" />
              <span>{tool.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Minimized Clean Chat Box Footer - Zero Horizontal Scroll */}
      <div className="p-2 sm:px-4 sm:pb-3 bg-[#09090b] border-t border-zinc-800/80 shrink-0 overflow-x-hidden">
        <div className="max-w-2xl mx-auto w-full">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="relative rounded-xl border border-zinc-800 bg-[#121218] shadow-md focus-within:border-indigo-500/60 transition-all p-1.5 flex flex-col gap-1 w-full overflow-hidden"
          >
            {/* Expandable Textarea with Strict No-Horizontal-Scroll */}
            <textarea
              ref={textareaRef}
              rows={1}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask anything, search jobs, review resume, draft emails, or sync mailbox..."
              disabled={isLoading}
              className="w-full bg-transparent px-2 pt-0.5 text-xs text-zinc-100 placeholder:text-zinc-500 focus:outline-none resize-none overflow-x-hidden overflow-y-auto break-words whitespace-pre-wrap max-h-32 min-h-[32px] leading-relaxed custom-scrollbar"
            />

            {/* Input Controls Bar */}
            <div className="flex items-center justify-between px-1 pt-1 border-t border-zinc-800/40">
              <div className="text-[9px] text-zinc-500 font-mono">
                <span>Enter ↵ to send • Shift+Enter for newline</span>
              </div>

              <button
                type="submit"
                disabled={!inputValue.trim() || isLoading}
                className="h-6 px-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-medium flex items-center gap-1 shadow-sm transition-all disabled:opacity-30 disabled:hover:bg-indigo-600 shrink-0"
              >
                <span>Send</span>
                <Send className="h-2.5 w-2.5" />
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Edit Draft Modal */}
      {editActionPayload && editingMessageId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-lg rounded-2xl border border-zinc-800 bg-[#121217] p-5 shadow-2xl flex flex-col gap-3">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-2.5">
              <h3 className="text-xs font-semibold text-white flex items-center gap-1.5">
                <Mail className="h-3.5 w-3.5 text-indigo-400" /> Edit Email Before Dispatch
              </h3>
              <button
                onClick={() => setEditActionPayload(null)}
                className="text-zinc-400 hover:text-white p-1 rounded hover:bg-zinc-800"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            <div>
              <label className="text-[10px] uppercase font-semibold text-zinc-400 block mb-1">
                Recipient Email
              </label>
              <input
                type="email"
                value={editActionPayload.toEmail || ""}
                onChange={(e) => setEditActionPayload({ ...editActionPayload, toEmail: e.target.value })}
                className="w-full h-8 rounded-lg border border-zinc-800 bg-[#09090b] px-2.5 text-xs text-white focus:outline-none focus:border-indigo-500/50"
              />
            </div>

            <div>
              <label className="text-[10px] uppercase font-semibold text-zinc-400 block mb-1">
                Email Subject
              </label>
              <input
                type="text"
                value={editActionPayload.subject || ""}
                onChange={(e) => setEditActionPayload({ ...editActionPayload, subject: e.target.value })}
                className="w-full h-8 rounded-lg border border-zinc-800 bg-[#09090b] px-2.5 text-xs text-white focus:outline-none focus:border-indigo-500/50"
              />
            </div>

            <div>
              <label className="text-[10px] uppercase font-semibold text-zinc-400 block mb-1">
                Email Body
              </label>
              <textarea
                rows={7}
                value={editActionPayload.body || ""}
                onChange={(e) => setEditActionPayload({ ...editActionPayload, body: e.target.value })}
                className="w-full rounded-lg border border-zinc-800 bg-[#09090b] p-2.5 text-xs text-zinc-200 resize-none font-sans focus:outline-none focus:border-indigo-500/50"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-800">
              <button
                onClick={() => setEditActionPayload(null)}
                className="px-3 py-1.5 text-xs text-zinc-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  const targetMsg = messages.find((m) => m.id === editingMessageId);
                  if (targetMsg) {
                    handleApproveAction(targetMsg, editActionPayload);
                  }
                }}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-semibold text-white shadow-md shadow-emerald-600/30"
              >
                Save & Dispatch via Gmail
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function getActionIcon(type: string) {
  switch (type) {
    case "ADD_JOBS":
      return <Briefcase className="h-3.5 w-3.5" />;
    case "SEND_OUTREACH":
    case "SEND_REPLY":
      return <Mail className="h-3.5 w-3.5" />;
    case "FIX_BOUNCE":
      return <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />;
    case "SYNC_MAILBOX":
      return <RefreshCw className="h-3.5 w-3.5" />;
    default:
      return <Sparkles className="h-3.5 w-3.5" />;
  }
}

function renderActionPreview(action: any) {
  const { type, payload } = action;

  if (type === "ADD_JOBS" && Array.isArray(payload?.jobs)) {
    return (
      <div className="rounded-xl border border-zinc-800/80 bg-black/40 p-2.5 divide-y divide-zinc-800/60 max-h-52 overflow-y-auto custom-scrollbar">
        {payload.jobs.map((j: any, i: number) => (
          <div key={i} className="py-1.5 flex items-center justify-between text-xs gap-2">
            <div className="min-w-0">
              <span className="font-semibold text-white">{j.company}</span>
              <span className="text-zinc-400 text-[11px] ml-2 truncate">
                {j.title}
              </span>
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 shrink-0 font-bold">
              {j.matchScore}% Match
            </span>
          </div>
        ))}
      </div>
    );
  }

  if (type === "FIX_BOUNCE" && payload?.newContact) {
    return (
      <div className="rounded-xl border border-zinc-800/80 bg-black/40 p-3 flex flex-col gap-2 text-xs">
        <div className="flex items-center gap-2 text-zinc-400 flex-wrap">
          <span className="line-through text-red-400/80 text-[11px]">
            {payload.oldEmails?.[0] || "old@company.com"}
          </span>
          <ArrowRight className="h-3.5 w-3.5 text-zinc-500 shrink-0" />
          <span className="font-semibold text-emerald-400">
            {payload.newContact.name} ({payload.newContact.email})
          </span>
        </div>
        <p className="text-[11px] text-zinc-500">
          Verified technical talent partner discovered on LinkedIn for {payload.company}.
        </p>
      </div>
    );
  }

  if ((type === "SEND_OUTREACH" || type === "SEND_REPLY") && payload) {
    return (
      <div className="rounded-xl border border-zinc-800/80 bg-black/40 p-3 flex flex-col gap-1.5 text-xs">
        <div className="flex items-center justify-between text-[11px] text-zinc-400">
          <span>Recipient: <strong className="text-zinc-200">{payload.toEmail}</strong></span>
          {payload.attachResume && (
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-800 text-indigo-300 border border-zinc-700">
              Resume PDF Attached ✓
            </span>
          )}
        </div>
        <div className="text-xs font-semibold text-white truncate">
          Subject: {payload.subject}
        </div>
        <p className="text-[11px] text-zinc-300 line-clamp-3 italic border-t border-zinc-800/60 pt-1.5 mt-1 leading-relaxed bg-black/30 p-2 rounded">
          &ldquo;{payload.body?.slice(0, 220)}...&rdquo;
        </p>
      </div>
    );
  }

  return null;
}

function renderFormattedText(text: string) {
  const lines = text.split("\n");
  return lines.map((line, idx) => {
    if (line.startsWith("### ")) {
      return (
        <h4 key={idx} className="font-bold text-white text-xs mt-2 mb-1 flex items-center gap-1.5 break-words">
          <span className="h-1.5 w-1.5 rounded-full bg-indigo-400 shrink-0" />
          <span className="break-words">{line.replace("### ", "")}</span>
        </h4>
      );
    }
    if (line.startsWith("## ")) {
      return (
        <h3 key={idx} className="font-bold text-white text-sm mt-2.5 mb-1 break-words">
          {line.replace("## ", "")}
        </h3>
      );
    }
    if (line.startsWith("---")) {
      return <hr key={idx} className="border-zinc-800 my-2" />;
    }
    if (line.startsWith("> ")) {
      return (
        <div
          key={idx}
          className="border-l-2 border-indigo-500 pl-3 italic text-zinc-300 text-xs my-1.5 bg-indigo-500/5 py-1 rounded-r break-words"
        >
          {line.replace("> ", "")}
        </div>
      );
    }
    if (line.startsWith("• ") || line.startsWith("- ")) {
      return (
        <div key={idx} className="flex items-start gap-2 pl-1 text-xs py-0.5 break-words">
          <span className="text-indigo-400 shrink-0 mt-0.5">•</span>
          <span className="flex-1 break-words min-w-0">{parseInlineMarkdown(line.slice(2))}</span>
        </div>
      );
    }

    return (
      <div key={idx} className="min-h-[1rem] break-words">
        {parseInlineMarkdown(line)}
      </div>
    );
  });
}

function parseInlineMarkdown(text: string) {
  const parts = text.split(/(\*\*.*?\*\*|`.*?`|\*.*?\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={i} className="font-semibold text-white">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith("*") && part.endsWith("*") && !part.startsWith("**")) {
      return (
        <em key={i} className="italic text-zinc-300">
          {part.slice(1, -1)}
        </em>
      );
    }
    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code
          key={i}
          className="rounded bg-black/50 px-1.5 py-0.5 font-mono text-[11px] text-indigo-300 border border-zinc-800"
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    return part;
  });
}
