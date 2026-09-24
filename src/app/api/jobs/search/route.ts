import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { searchUnifiedJobs } from "@/lib/scrapers/job-search";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const keywords = searchParams.get("keywords") || undefined;
  const location = searchParams.get("location") || searchParams.get("locations") || undefined;
  const isAutoDiscover = searchParams.get("auto") === "true";
  const sourcesParam = searchParams.get("sources");
  const sources = sourcesParam ? (sourcesParam.split(",") as ("linkedin" | "remoteok" | "arbeitnow")[]) : undefined;

  return handleJobSearch({ keywords, location, isAutoDiscover, sources });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  return handleJobSearch(body);
}

async function handleJobSearch(params: {
  keywords?: string;
  location?: string | string[];
  locations?: string | string[];
  isAutoDiscover?: boolean;
  sources?: ("linkedin" | "remoteok" | "arbeitnow")[];
}) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let { keywords } = params;
    let locations = params.locations || params.location;

    // Load candidate profile for auto-discovery
    const profile = await prisma.candidateProfile.findUnique({
      where: { userId: session.user.id },
    });

    if (!keywords) {
      keywords = profile?.targetRoles?.[0] || "Systems Engineer";
    }

    // Auto-discover location resolution: use multiple locations from profile or default global hubs
    if (!locations || (Array.isArray(locations) && locations.length === 0)) {
      if (profile?.preferredLocations && profile.preferredLocations.length > 0) {
        locations = profile.preferredLocations;
      } else {
        locations = ["Remote", "Singapore", "United States"];
      }
    }

    const candidateSkills = profile?.skills?.length
      ? profile.skills
      : ["C++", "Python", "Linux", "Docker", "Reverse Engineering", "Distributed Systems"];
    const candidateRoles = profile?.targetRoles?.length
      ? profile.targetRoles
      : ["Systems Engineer", "Security Researcher", "Backend Platform Engineer"];
    const preferredLocations = profile?.preferredLocations?.length
      ? profile.preferredLocations
      : ["Remote", "Global"];

    // 1. Multi-source unified search across LinkedIn, RemoteOK, and Arbeitnow
    const jobs = await searchUnifiedJobs({
      keywords,
      locations,
      limit: 60,
      sources: params.sources || ["linkedin", "remoteok", "arbeitnow"],
      candidateSkills,
      candidateRoles,
      preferredLocations,
    });

    // 2. Fetch existing user jobs to identify which are already in pipeline
    const existingJobs = await prisma.job.findMany({
      where: { userId: session.user.id },
      select: { company: true, title: true, id: true, status: true },
    });

    // 3. Mark in-pipeline status
    const enrichedJobs = jobs.map((job) => {
      const inPipeline = existingJobs.find(
        (ej) =>
          ej.company.toLowerCase() === job.company.toLowerCase() &&
          (ej.title.toLowerCase().includes(job.title.toLowerCase().slice(0, 8)) ||
            job.title.toLowerCase().includes(ej.title.toLowerCase().slice(0, 8)))
      );

      return {
        ...job,
        alreadySaved: !!inPipeline,
        existingJobId: inPipeline?.id,
        existingStatus: inPipeline?.status,
      };
    });

    return NextResponse.json({
      success: true,
      query: { keywords, locations },
      jobs: enrichedJobs,
      totalCount: enrichedJobs.length,
    });
  } catch (err: unknown) {
    console.error("[API /api/jobs/search] Error:", err);
    return NextResponse.json(
      { error: (err as Error).message || "Failed to search jobs" },
      { status: 500 }
    );
  }
}
