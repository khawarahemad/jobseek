import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma, withDbRetry } from "@/lib/prisma";
import { executeCopilotAction } from "@/lib/ai/copilot-agent";

export async function POST(request: Request) {
  try {
    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const { messageId, type, payload, approved = true } = body;

    if (!type || !payload) {
      return NextResponse.json({ error: "Action type and payload are required" }, { status: 400 });
    }

    // 1. If dismissed by user
    if (!approved) {
      if (messageId) {
        try {
          if ((prisma as any).aiChatMessage) {
            await withDbRetry(() =>
              (prisma as any).aiChatMessage.update({
                where: { id: messageId },
                data: {
                  actionPayload: {
                    type,
                    payload,
                    status: "DISMISSED",
                  },
                },
              })
            );
          }
        } catch {
          // ignore
        }
      }
      return NextResponse.json({ success: true, status: "DISMISSED" });
    }

    // 2. Execute the approved action
    const result = await executeCopilotAction(userId, { type, payload });

    if (!result.success) {
      return NextResponse.json({ error: result.message }, { status: 500 });
    }

    // 3. Update the action status in the message and resolve sessionId
    let targetSessionId = body.sessionId || null;
    if (messageId) {
      try {
        if ((prisma as any).aiChatMessage) {
          const originalMsg: any = await withDbRetry(() =>
            (prisma as any).aiChatMessage.findUnique({
              where: { id: messageId },
              select: { sessionId: true },
            })
          );
          if (originalMsg?.sessionId) {
            targetSessionId = originalMsg.sessionId;
          }

          await withDbRetry(() =>
            (prisma as any).aiChatMessage.update({
              where: { id: messageId },
              data: {
                actionPayload: {
                  type,
                  payload,
                  status: "EXECUTED",
                  result: result.data || result.message,
                },
              },
            })
          );
        }
      } catch {
        // ignore
      }
    }

    // Touch session updatedAt if sessionId resolved
    if (targetSessionId) {
      try {
        await withDbRetry(() =>
          prisma.aiChatSession.update({
            where: { id: targetSessionId },
            data: { updatedAt: new Date() },
          })
        );
      } catch {
        // ignore
      }
    }

    // 4. Log a confirmation message from assistant
    let confirmationMsg: any = {
      id: `cfm-${Date.now()}`,
      role: "assistant",
      content: `✅ **Action Executed:** ${result.message}`,
      sessionId: targetSessionId,
      createdAt: new Date().toISOString(),
    };
    try {
      if ((prisma as any).aiChatMessage) {
        confirmationMsg = await withDbRetry(() =>
          (prisma as any).aiChatMessage.create({
            data: {
              userId,
              sessionId: targetSessionId,
              role: "assistant",
              content: `✅ **Action Executed:** ${result.message}`,
            },
          })
        );
      }
    } catch {
      // ignore
    }

    return NextResponse.json({
      success: true,
      result,
      confirmationMessage: confirmationMsg,
    });
  } catch (err: unknown) {
    console.error("[API /api/ai/chat/action] Error:", err);
    return NextResponse.json(
      { error: (err as Error).message || "Failed to execute copilot action" },
      { status: 500 }
    );
  }
}
