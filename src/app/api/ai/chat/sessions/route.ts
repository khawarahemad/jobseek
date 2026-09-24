import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma, withDbRetry } from "@/lib/prisma";

export async function GET() {
  try {
    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const sessions = await withDbRetry(() =>
      prisma.aiChatSession.findMany({
        where: { userId },
        orderBy: { updatedAt: "desc" },
        include: {
          messages: {
            take: 1,
            orderBy: { createdAt: "desc" },
            select: { content: true, role: true, createdAt: true },
          },
          _count: {
            select: { messages: true },
          },
        },
      })
    );

    // If user has no sessions yet, create an initial default one
    if (sessions.length === 0) {
      const initialSession = await withDbRetry(() =>
        prisma.aiChatSession.create({
          data: {
            userId,
            title: "Career Strategy & Copilot",
          },
          include: {
            messages: {
              take: 1,
              orderBy: { createdAt: "desc" },
              select: { content: true, role: true, createdAt: true },
            },
            _count: {
              select: { messages: true },
            },
          },
        })
      );
      return NextResponse.json({ sessions: [initialSession], activeSessionId: initialSession.id });
    }

    return NextResponse.json({
      sessions,
      activeSessionId: sessions[0]?.id,
    });
  } catch (err: unknown) {
    console.error("GET /api/ai/chat/sessions error:", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
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
    const title = (body.title || "New Chat").trim();

    const newSession = await withDbRetry(() =>
      prisma.aiChatSession.create({
        data: {
          userId,
          title: title.slice(0, 60),
        },
      })
    );

    return NextResponse.json({ session: newSession, success: true });
  } catch (err: unknown) {
    console.error("POST /api/ai/chat/sessions error:", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
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
    const sessionId = searchParams.get("id");

    if (!sessionId) {
      return NextResponse.json({ error: "Session ID required" }, { status: 400 });
    }

    await withDbRetry(() =>
      prisma.aiChatSession.deleteMany({
        where: { id: sessionId, userId },
      })
    );

    return NextResponse.json({ success: true, deletedId: sessionId });
  } catch (err: unknown) {
    console.error("DELETE /api/ai/chat/sessions error:", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const { id, title } = body;

    if (!id || !title) {
      return NextResponse.json({ error: "Session ID and title required" }, { status: 400 });
    }

    const updated = await withDbRetry(() =>
      prisma.aiChatSession.updateMany({
        where: { id, userId },
        data: { title: title.trim().slice(0, 60) },
      })
    );

    return NextResponse.json({ success: true, updated });
  } catch (err: unknown) {
    console.error("PATCH /api/ai/chat/sessions error:", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
