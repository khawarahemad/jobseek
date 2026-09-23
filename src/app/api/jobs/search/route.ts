import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { scrapeLinkedInJobs, calculateMatchScore } from "@/lib/scrapers/linkedin";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const keywords = searchParams.get("keywords") || undefined;
  const location = searchParams.get("location") || searchParams.get("locations") || undefined;
  const isAutoDiscover = searchParams.get("auto") === "true";
  return handleJobSearch({ keywords, location, isAutoDiscover });
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
      keywords = profile?.targetRoles?.[0] || "Cyber Security";
    }

    // Auto-discover location resolution: use multiple locations from profile or default global hubs
    if (!locations || (Array.isArray(locations) && locations.length === 0)) {
      if (profile?.preferredLocations && profile.preferredLocations.length > 0) {
        locations = profile.preferredLocations;
      } else {
        locations = ["Remote", "Singapore", "United States"];
      }
    }

    // 1. Scrape live LinkedIn guest jobs across all requested locations
    const queryKeywords = keywords || "Software Engineer";
    const scraped = await scrapeLinkedInJobs({
      keywords: queryKeywords,
      location: locations,
      limit: 45,
    });

    // 2. Fetch existing user jobs to show which are already in pipeline
    const existingJobs = await prisma.job.findMany({
      where: { userId: session.user.id },
      select: { company: true, title: true, id: true, status: true },
    });

    const candidateSkills = profile?.skills || [
      "C++", "Python", "PostgreSQL", "Docker", "Reverse Engineering", "Distributed Systems"
    ];
    const candidateRoles = profile?.targetRoles || ["Systems Engineer", "Security Researcher"];

    // 3. Compute match scores and pipeline status
    const enrichedJobs = scraped.map((job) => {
      const match = calculateMatchScore(job, candidateSkills, candidateRoles);
      const inPipeline = existingJobs.find(
        (ej) =>
          ej.company.toLowerCase() === job.company.toLowerCase() &&
          ej.title.toLowerCase().includes(job.title.toLowerCase().slice(0, 10))
      );

      return {
        ...job,
        matchScore: match.score,
        matchedSkills: match.matchedSkills,
        alreadySaved: !!inPipeline,
        existingJobId: inPipeline?.id,
        existingStatus: inPipeline?.status,
      };
    });

    // Sort by match score descending
    enrichedJobs.sort((a, b) => b.matchScore - a.matchScore);

    return NextResponse.json({
      success: true,
      query: { keywords, locations },
      jobs: enrichedJobs,
    });
  } catch (err: unknown) {
    console.error("[API /api/jobs/search] Error:", err);
    return NextResponse.json(
      { error: (err as Error).message || "Failed to search jobs" },
      { status: 500 }
    );
  }
}
