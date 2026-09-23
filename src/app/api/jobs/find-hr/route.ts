import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { discoverHrContacts } from "@/lib/scrapers/hr-finder";

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { jobId, company, url } = body;

    let targetCompany = company;
    let targetUrl = url;

    if (jobId) {
      const job = await prisma.job.findUnique({
        where: { id: jobId },
      });
      if (job && job.userId === session.user.id) {
        targetCompany = job.company;
        targetUrl = job.url;
      }
    }

    if (!targetCompany) {
      return NextResponse.json({ error: "Missing company name" }, { status: 400 });
    }

    // 1. Discover at least 5 HR contacts
    const hrDiscovery = await discoverHrContacts({
      company: targetCompany,
      url: targetUrl,
    });

    // 2. If jobId provided, persist contacts on the job record
    if (jobId) {
      await prisma.job.update({
        where: { id: jobId },
        data: {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          hrContacts: hrDiscovery.contacts as any,
          hrEmail: hrDiscovery.contacts[0]?.email || undefined,
          hrName: hrDiscovery.contacts[0]?.name || undefined,
        },
      });
    }

    return NextResponse.json({
      success: true,
      hrDiscovery,
      contacts: hrDiscovery.contacts,
    });

  } catch (err: unknown) {
    console.error("[API /api/jobs/find-hr] Error:", err);
    return NextResponse.json(
      { error: (err as Error).message || "Internal server error" },
      { status: 500 }
    );
  }
}
