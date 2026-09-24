import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma, withDbRetry } from "@/lib/prisma";
import { processCopilotMessage, getUserFullContext } from "@/lib/ai/copilot-agent";

export async function GET(request: Request) {
  try {
    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    let sessionId = searchParams.get("sessionId");

    // 1. Resolve active session fast
    let chatSession: any = null;
    if (sessionId) {
      chatSession = await withDbRetry(() =>
        prisma.aiChatSession.findFirst({
          where: { id: sessionId as string, userId },
          select: { id: true, title: true, updatedAt: true },
        })
      );
    }

    if (!chatSession) {
      chatSession = await withDbRetry(() =>
        prisma.aiChatSession.findFirst({
          where: { userId },
          orderBy: { updatedAt: "desc" },
          select: { id: true, title: true, updatedAt: true },
        })
      );
    }

    if (!chatSession) {
      chatSession = await withDbRetry(() =>
        prisma.aiChatSession.create({
          data: {
            userId,
            title: "Career Strategy & Copilot",
          },
          select: { id: true, title: true, updatedAt: true },
        })
      );
    }

    sessionId = chatSession.id;

    // 2. Fetch messages for this session
    let messages: any[] = [];
    try {
      if ((prisma as any).aiChatMessage) {
        messages = await withDbRetry(() =>
          (prisma as any).aiChatMessage.findMany({
            where: {
              userId,
              sessionId,
            },
            orderBy: { createdAt: "asc" },
            take: 60,
            select: {
              id: true,
              role: true,
              content: true,
              actionPayload: true,
              sessionId: true,
              createdAt: true,
            },
          })
        );
      }
    } catch (msgErr) {
      console.warn("[API /api/ai/chat GET] Message fetch notice:", msgErr);
    }

    return NextResponse.json({
      success: true,
      sessionId: chatSession.id,
      sessionTitle: chatSession.title,
      messages: messages || [],
    });
  } catch (err: unknown) {
    console.error("[API /api/ai/chat GET] Error:", err);
    return NextResponse.json(
      { error: (err as Error).message || "Failed to fetch chat history" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const message = body?.message?.trim();
    let sessionId = body?.sessionId;

    if (!message) {
      return NextResponse.json({ error: "Message is required" }, { status: 400 });
    }

    // 1. Ensure a valid active session
    let chatSession: any = null;
    if (sessionId) {
      chatSession = await withDbRetry(() =>
        prisma.aiChatSession.findFirst({
          where: { id: sessionId as string, userId },
        })
      );
    }

    if (!chatSession) {
      const derivedTitle = generateSessionTitle(message);
      chatSession = await withDbRetry(() =>
        prisma.aiChatSession.create({
          data: {
            userId,
            title: derivedTitle,
          },
        })
      );
    } else if (
      chatSession.title === "New Chat" ||
      chatSession.title === "New Conversation" ||
      chatSession.title === "Career Strategy & Copilot"
    ) {
      // Auto-update title based on first query
      const derivedTitle = generateSessionTitle(message);
      await withDbRetry(() =>
        prisma.aiChatSession.update({
          where: { id: chatSession.id },
          data: { title: derivedTitle, updatedAt: new Date() },
        })
      );
      chatSession.title = derivedTitle;
    } else {
      // Touch updatedAt
      await withDbRetry(() =>
        prisma.aiChatSession.update({
          where: { id: chatSession.id },
          data: { updatedAt: new Date() },
        })
      );
    }

    sessionId = chatSession.id;

    // 2. Retrieve recent conversation history for this session (for multi-turn memory & context)
    let conversationHistory: Array<{ role: string; content: string }> = [];
    try {
      if ((prisma as any).aiChatMessage) {
        const pastMsgs = await withDbRetry(() =>
          (prisma as any).aiChatMessage.findMany({
            where: { userId, sessionId },
            orderBy: { createdAt: "desc" },
            take: 8,
            select: { role: true, content: true },
          })
        );
        if (pastMsgs && Array.isArray(pastMsgs)) {
          conversationHistory = [...pastMsgs].reverse().map((m: any) => ({
            role: m.role,
            content: m.content,
          }));
        }
      }
    } catch (histErr) {
      console.warn("[API /api/ai/chat POST] History load notice:", histErr);
    }

    // 3. Save user message
    let userMsg: any = {
      id: `usr-${Date.now()}`,
      role: "user",
      content: message,
      sessionId,
      createdAt: new Date().toISOString(),
    };
    try {
      if ((prisma as any).aiChatMessage) {
        userMsg = await withDbRetry(() =>
          (prisma as any).aiChatMessage.create({
            data: {
              userId,
              sessionId,
              role: "user",
              content: message,
            },
          })
        );
      }
    } catch (e) {
      console.warn("[API /api/ai/chat POST] User message save notice:", e);
    }

    // 4. Process message via Copilot Agent with full session context
    const copilotRes = await processCopilotMessage({
      userId,
      message,
      conversationHistory,
    });

    // 5. Save assistant response
    let assistantMsg: any = {
      id: `ast-${Date.now()}`,
      role: "assistant",
      content: copilotRes.replyText,
      sessionId,
      actionPayload: copilotRes.action || null,
      createdAt: new Date().toISOString(),
    };
    try {
      if ((prisma as any).aiChatMessage) {
        assistantMsg = await withDbRetry(() =>
          (prisma as any).aiChatMessage.create({
            data: {
              userId,
              sessionId,
              role: "assistant",
              content: copilotRes.replyText,
              actionPayload: copilotRes.action ? (copilotRes.action as any) : null,
            },
          })
        );
      }
    } catch (e) {
      console.warn("[API /api/ai/chat POST] Assistant message save notice:", e);
    }

    return NextResponse.json({
      success: true,
      sessionId,
      sessionTitle: chatSession.title,
      userMessage: userMsg,
      assistantMessage: assistantMsg,
    });
  } catch (err: unknown) {
    console.error("[API /api/ai/chat POST] Error:", err);
    return NextResponse.json(
      { error: (err as Error).message || "Failed to process chat message" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get("sessionId");

    try {
      if ((prisma as any).aiChatMessage) {
        if (sessionId) {
          await withDbRetry(() =>
            (prisma as any).aiChatMessage.deleteMany({
              where: { userId, sessionId },
            })
          );
        } else {
          await withDbRetry(() =>
            (prisma as any).aiChatMessage.deleteMany({
              where: { userId },
            })
          );
        }
      }
    } catch (e) {
      console.warn("[API /api/ai/chat DELETE] Notice:", e);
    }

    return NextResponse.json({ success: true, clearedSessionId: sessionId || "all" });
  } catch (err: unknown) {
    console.error("[API /api/ai/chat DELETE] Error:", err);
    return NextResponse.json(
      { error: (err as Error).message || "Failed to clear chat history" },
      { status: 500 }
    );
  }
}

function generateSessionTitle(prompt: string): string {
  const clean = prompt.trim();
  if (clean.toLowerCase().includes("resume") || clean.toLowerCase().includes("cv")) {
    return "Resume Review & Feedback";
  }
  if (clean.toLowerCase().includes("bounce") || clean.toLowerCase().includes("failed")) {
    return "Fix Bounced Leads";
  }
  if (clean.toLowerCase().includes("reply") || clean.toLowerCase().includes("replay")) {
    return "Recruiter Reply Copilot";
  }
  if (clean.toLowerCase().includes("plan") || clean.toLowerCase().includes("strategy")) {
    return "Career Search Strategy";
  }
  if (clean.toLowerCase().includes("find") || clean.toLowerCase().includes("search")) {
    const match = clean.match(/(?:find|search|jobs for)\s+([A-Za-z0-9\s-]+)/i);
    return match && match[1] ? `Jobs: ${match[1].trim().slice(0, 24)}` : "Job Search Discovery";
  }
  if (clean.toLowerCase().includes("mail to") || clean.toLowerCase().includes("email to") || clean.toLowerCase().includes("outreach")) {
    const companyMatch = clean.match(/(?:for|to|at)\s+([A-Za-z0-9._-]+)/i);
    return companyMatch && companyMatch[1] ? `Outreach: ${companyMatch[1]}` : "Cold Email Outreach";
  }
  return clean.slice(0, 32);
}
