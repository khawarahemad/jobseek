import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { researchCompany } from "@/lib/ai/researcher";
import { generatePersonalizedEmail } from "@/lib/ai/drafter";

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { jobId, templateId } = body;

    if (!jobId) {
      return NextResponse.json({ error: "Missing jobId" }, { status: 400 });
    }

    // Ensure user owns this job
    const job = await prisma.job.findUnique({
      where: { id: jobId },
    });

    if (!job || job.userId !== session.user.id) {
      return NextResponse.json({ error: "Job lead not found" }, { status: 404 });
    }

    // Fetch template if provided, or default user template
    let template = null;
    if (templateId) {
      template = await prisma.template.findFirst({
        where: { id: templateId, userId: session.user.id },
      });
    } else {
      template = await prisma.template.findFirst({
        where: { userId: session.user.id },
        orderBy: { createdAt: "asc" },
      });
    }

    // 1. Autonomous Web Research
    const research = await researchCompany({
      company: job.company,
      role: job.title,
      url: job.url,
      customContext: job.customContext,
    });

    // 2. AI Email Drafting
    const draft = await generatePersonalizedEmail({
      company: job.company,
      role: job.title,
      hrName: job.hrName,
      candidateName: session.user.name || "Khawar Ahemad Khan",
      templateSubject: template?.subject,
      templateBody: template?.body,
      research,
    });

    // 3. Persist research findings and draft to job record
    await prisma.job.update({
      where: { id: jobId },
      data: {
        researchedInfo: research.rawContext,
        generatedSubject: draft.subject,
        generatedBody: draft.body,
      },
    });

    return NextResponse.json({
      success: true,
      research,
      draft,
    });
  } catch (err: unknown) {
    console.error("[API /api/jobs/draft] Error:", err);
    return NextResponse.json(
      { error: (err as Error).message || "Internal server error" },
      { status: 500 }
    );
  }
}
