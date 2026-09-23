import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma, withDbRetry } from "@/lib/prisma";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;
    const jobs = await withDbRetry(() =>
      prisma.job.findMany({
        where: { userId },
        include: {
          outreachLogs: {
            orderBy: { sentAt: "desc" },
          },
        },
        orderBy: { createdAt: "desc" },
      })
    );


    return NextResponse.json({ jobs });
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
    const { company, title, url, hrEmail, hrName, customContext, status } = body;

    if (!company || !title) {
      return NextResponse.json(
        { error: "Company name and title are required" },
        { status: 400 }
      );
    }

    const job = await prisma.job.create({
      data: {
        userId: session.user.id,
        company,
        title,
        url,
        hrEmail,
        hrName,
        customContext,
        status: status || "SOURCED",
      },
    });

    return NextResponse.json({ success: true, job });
  } catch (err: unknown) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { id, status, company, title, hrEmail, customContext } = body;

    if (!id) {
      return NextResponse.json({ error: "Missing job id" }, { status: 400 });
    }

    // Ensure user owns job
    const existing = await prisma.job.findUnique({
      where: { id },
    });

    if (!existing || existing.userId !== session.user.id) {
      return NextResponse.json({ error: "Job lead not found" }, { status: 404 });
    }

    const updated = await prisma.job.update({
      where: { id },
      data: {
        ...(status && { status }),
        ...(company && { company }),
        ...(title && { title }),
        ...(hrEmail && { hrEmail }),
        ...(customContext !== undefined && { customContext }),
      },
    });

    return NextResponse.json({ success: true, job: updated });
  } catch (err: unknown) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
