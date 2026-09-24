import { scrapeLinkedInJobs, ScrapedJob } from "./linkedin";

export interface UnifiedJob {
  id: string;
  title: string;
  company: string;
  location: string;
  jobUrl: string;
  postedDate?: string;
  source: "LinkedIn" | "RemoteOK" | "Arbeitnow" | "PublicTech";
  tags?: string[];
  matchScore: number;
  matchedSkills: string[];
  matchReason?: string;
  alreadySaved?: boolean;
  existingJobId?: string;
  existingStatus?: string;
}

export interface SearchJobsOptions {
  keywords?: string;
  locations?: string | string[];
  limit?: number;
  sources?: ("linkedin" | "remoteok" | "arbeitnow")[];
  candidateSkills?: string[];
  candidateRoles?: string[];
  preferredLocations?: string[];
}

/**
 * Fetches real tech jobs from RemoteOK public API
 */
async function fetchRemoteOkJobs(keywords: string, limit = 25): Promise<ScrapedJob[]> {
  try {
    const res = await fetch("https://remoteok.com/api", {
      headers: {
        "User-Agent": "JobOpsCRM/1.0 (Mozilla/5.0)",
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(6000),
    });

    if (!res.ok) return [];
    const data = await res.json();
    if (!Array.isArray(data)) return [];

    const kwLower = keywords.toLowerCase();
    const kwTokens = kwLower.split(/\s+/).filter(Boolean);

    const jobs: ScrapedJob[] = [];
    // Index 0 in remoteok is legal disclaimer, items start from 1
    for (let i = 1; i < data.length && jobs.length < limit; i++) {
      const item = data[i];
      if (!item || !item.position || !item.company) continue;

      const fullText = `${item.position} ${item.company} ${item.tags?.join(" ") || ""} ${item.description || ""}`.toLowerCase();

      // Check if matches any token
      const matches = kwTokens.some((tok) => fullText.includes(tok));
      if (!matches && kwTokens.length > 0) continue;

      const cleanId = Buffer.from(`remoteok-${item.id || item.company}-${item.position}`)
        .toString("base64")
        .replace(/[^a-zA-Z0-9]/g, "")
        .slice(0, 16);

      jobs.push({
        id: cleanId,
        title: String(item.position).trim(),
        company: String(item.company).trim(),
        location: item.location || "Remote",
        jobUrl: item.url || item.apply_url || `https://remoteok.com/l/${item.id}`,
        postedDate: item.date ? new Date(item.date).toLocaleDateString() : "Recent",
        source: "RemoteOK" as any,
        skillsFound: Array.isArray(item.tags) ? item.tags.slice(0, 5) : [],
      });
    }

    return jobs;
  } catch (err) {
    console.warn("[JobSearch] RemoteOK fetch notice:", (err as Error).message);
    return [];
  }
}

/**
 * Fetches real tech jobs from Arbeitnow public board
 */
async function fetchArbeitnowJobs(keywords: string, limit = 25): Promise<ScrapedJob[]> {
  try {
    const res = await fetch("https://www.arbeitnow.com/api/job-board-api", {
      headers: {
        "User-Agent": "JobOpsCRM/1.0",
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(6000),
    });

    if (!res.ok) return [];
    const data = await res.json();
    const items = data?.data;
    if (!Array.isArray(items)) return [];

    const kwLower = keywords.toLowerCase();
    const kwTokens = kwLower.split(/\s+/).filter(Boolean);

    const jobs: ScrapedJob[] = [];
    for (const item of items) {
      if (jobs.length >= limit) break;
      if (!item.title || !item.company_name) continue;

      const fullText = `${item.title} ${item.company_name} ${item.tags?.join(" ") || ""}`.toLowerCase();
      const matches = kwTokens.length === 0 || kwTokens.some((tok) => fullText.includes(tok));
      if (!matches) continue;

      const cleanId = Buffer.from(`arbeitnow-${item.slug || item.company_name}-${item.title}`)
        .toString("base64")
        .replace(/[^a-zA-Z0-9]/g, "")
        .slice(0, 16);

      jobs.push({
        id: cleanId,
        title: item.title.trim(),
        company: item.company_name.trim(),
        location: item.remote ? "Remote" : item.location || "Global",
        jobUrl: item.url,
        postedDate: "Recent",
        source: "Arbeitnow" as any,
        skillsFound: Array.isArray(item.tags) ? item.tags.slice(0, 5) : [],
      });
    }

    return jobs;
  } catch (err) {
    console.warn("[JobSearch] Arbeitnow fetch notice:", (err as Error).message);
    return [];
  }
}

/**
 * Unified Multi-Platform Job Search & Intelligence Engine.
 * Aggregates live jobs from LinkedIn, RemoteOK, and Arbeitnow, deduplicates,
 * and scores each position against the candidate profile.
 */
export async function searchUnifiedJobs(options: SearchJobsOptions): Promise<UnifiedJob[]> {
  const {
    keywords = "Systems Engineer",
    locations = "Remote",
    limit = 50,
    sources = ["linkedin", "remoteok", "arbeitnow"],
    candidateSkills = ["C++", "Python", "Linux", "Docker", "Security"],
    candidateRoles = ["Systems Engineer", "Security Researcher", "Backend Engineer"],
    preferredLocations = ["Remote"],
  } = options;

  const resultsMap = new Map<string, UnifiedJob>();

  // Fetch concurrently across selected sources
  const tasks: Promise<void>[] = [];

  if (sources.includes("linkedin")) {
    tasks.push(
      scrapeLinkedInJobs({
        keywords,
        location: locations,
        limit: Math.max(Math.ceil(limit * 0.6), 25),
      })
        .then((linkedInJobs) => {
          for (const j of linkedInJobs) {
            const key = `${j.company.toLowerCase()}-${j.title.toLowerCase()}`.replace(/[^a-z0-9]/g, "");
            if (!resultsMap.has(key)) {
              resultsMap.set(key, scoreAndEnrichJob(j, candidateSkills, candidateRoles, preferredLocations));
            }
          }
        })
        .catch((err) => console.warn("[JobSearch] LinkedIn search error:", err.message))
    );
  }

  if (sources.includes("remoteok")) {
    tasks.push(
      fetchRemoteOkJobs(keywords, Math.max(Math.ceil(limit * 0.4), 20))
        .then((rokJobs) => {
          for (const j of rokJobs) {
            const key = `${j.company.toLowerCase()}-${j.title.toLowerCase()}`.replace(/[^a-z0-9]/g, "");
            if (!resultsMap.has(key)) {
              resultsMap.set(key, scoreAndEnrichJob(j, candidateSkills, candidateRoles, preferredLocations));
            }
          }
        })
        .catch((err) => console.warn("[JobSearch] RemoteOK search error:", err.message))
    );
  }

  if (sources.includes("arbeitnow")) {
    tasks.push(
      fetchArbeitnowJobs(keywords, 20)
        .then((abJobs) => {
          for (const j of abJobs) {
            const key = `${j.company.toLowerCase()}-${j.title.toLowerCase()}`.replace(/[^a-z0-9]/g, "");
            if (!resultsMap.has(key)) {
              resultsMap.set(key, scoreAndEnrichJob(j, candidateSkills, candidateRoles, preferredLocations));
            }
          }
        })
        .catch((err) => console.warn("[JobSearch] Arbeitnow search error:", err.message))
    );
  }

  await Promise.allSettled(tasks);

  // Return jobs sorted by match score descending
  const sortedJobs = Array.from(resultsMap.values()).sort((a, b) => b.matchScore - a.matchScore);
  return sortedJobs.slice(0, limit);
}

/**
 * High-precision scoring algorithm mapping role, skills, location to a 0-99 score
 */
function scoreAndEnrichJob(
  job: ScrapedJob,
  candidateSkills: string[],
  candidateRoles: string[],
  preferredLocations: string[]
): UnifiedJob {
  const fullText = `${job.title} ${job.company} ${job.skillsFound?.join(" ") || ""}`.toLowerCase();
  const matchedSkills: string[] = [];

  for (const s of candidateSkills) {
    if (s && fullText.includes(s.toLowerCase())) {
      matchedSkills.push(s);
    }
  }

  let roleScore = 65;
  let matchedRole = "";
  for (const r of candidateRoles) {
    if (r && fullText.includes(r.toLowerCase())) {
      roleScore = 85;
      matchedRole = r;
      break;
    }
  }

  // Location bonus
  let locBonus = 0;
  const jobLoc = (job.location || "").toLowerCase();
  for (const pref of preferredLocations) {
    const prefClean = pref.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (jobLoc.includes(prefClean) || jobLoc.includes("remote") || prefClean.includes("remote")) {
      locBonus = 5;
      break;
    }
  }

  const skillBonus = Math.min(matchedSkills.length * 4, 15);
  const finalScore = Math.min(roleScore + skillBonus + locBonus, 99);

  let matchReason = "";
  if (matchedRole && matchedSkills.length > 0) {
    matchReason = `Direct match for "${matchedRole}" + ${matchedSkills.length} skills (${matchedSkills.slice(0, 3).join(", ")})`;
  } else if (matchedSkills.length > 0) {
    matchReason = `Matched skills: ${matchedSkills.join(", ")}`;
  } else {
    matchReason = `General alignment with engineering background`;
  }

  return {
    id: job.id,
    title: job.title,
    company: job.company,
    location: job.location,
    jobUrl: job.jobUrl,
    postedDate: job.postedDate,
    source: (job.source as any) || "LinkedIn",
    tags: job.skillsFound || [],
    matchScore: finalScore,
    matchedSkills,
    matchReason,
  };
}
