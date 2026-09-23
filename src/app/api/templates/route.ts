import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const templates = await prisma.template.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ templates });
  } catch (err: unknown) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { name, category, subject, emailBody } = body;

    if (!name || !subject || !emailBody) {
      return NextResponse.json(
        { error: "Name, subject, and email body are required" },
        { status: 400 }
      );
    }

    const template = await prisma.template.create({
      data: {
        userId: session.user.id,
        name,
        category: category || "General",
        subject,
        body: emailBody,
      },
    });

    return NextResponse.json({ success: true, template });
  } catch (err: unknown) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { id, name, category, subject, emailBody } = body;

    if (!id) {
      return NextResponse.json({ error: "Missing template id" }, { status: 400 });
    }

    const existing = await prisma.template.findUnique({
      where: { id },
    });

    if (!existing || existing.userId !== session.user.id) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }

    const updated = await prisma.template.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(category && { category }),
        ...(subject && { subject }),
        ...(emailBody && { body: emailBody }),
      },
    });

    return NextResponse.json({ success: true, template: updated });
  } catch (err: unknown) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
