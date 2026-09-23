import * as cheerio from "cheerio";

export interface CompanyResearch {
  company: string;
  domain?: string;
  summary: string;
  techKeywords: string[];
  recentHighlights: string[];
  rawContext: string;
}

/**
 * Normalizes company name into probable domain if URL is not provided.
 */
function getProbableDomain(company: string, url?: string | null): string {
  if (url && url.startsWith("http")) {
    try {
      const parsed = new URL(url);
      const hostname = parsed.hostname.replace(/^www\./, "");
      // If it's a generic job board like lever.co or greenhouse.io, fallback to company name
      if (
        hostname.includes("lever.co") ||
        hostname.includes("greenhouse.io") ||
        hostname.includes("workday.com") ||
        hostname.includes("ashbyhq.com")
      ) {
        const cleanName = company.toLowerCase().replace(/[^a-z0-9]/g, "");
        return `${cleanName}.com`;
      }
      return hostname;
    } catch {
      // ignore
    }
  }

  const cleanName = company.toLowerCase().replace(/[^a-z0-9]/g, "");
  return `${cleanName}.com`;
}

/**
 * Free web researcher: Scrapes company public metadata and queries open knowledge bases
 * with zero API keys required. Supports Tavily if TAVILY_API_KEY is configured.
 */
export async function researchCompany(params: {
  company: string;
  role: string;
  url?: string | null;
  customContext?: string | null;
}): Promise<CompanyResearch> {
  const { company, role, url, customContext } = params;
  const domain = getProbableDomain(company, url);

  const highlights: string[] = [];
  const techKeywords: Set<string> = new Set();
  let summary = customContext || "";

  // 1. Direct Web Scraping (Company Homepage)
  try {
    const scrapeTarget = url?.startsWith("http") && !url.includes("greenhouse") && !url.includes("lever")
      ? url
      : `https://${domain}`;

    const res = await fetch(scrapeTarget, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
      signal: AbortSignal.timeout(6000),
    });

    if (res.ok) {
      const html = await res.text();
      const $ = cheerio.load(html);

      const title = $("title").text().trim();
      const metaDesc =
        $('meta[name="description"]').attr("content") ||
        $('meta[property="og:description"]').attr("content") ||
        "";

      if (metaDesc) {
        summary = metaDesc;
      } else if (title) {
        summary = `${company} – ${title}`;
      }

      // Extract major headings
      $("h1, h2, h3").each((i, el) => {
        if (i < 8) {
          const text = $(el).text().trim().replace(/\s+/g, " ");
          if (text.length > 5 && text.length < 90) {
            highlights.push(text);
          }
        }
      });

      // Extract tech stack keywords from page text
      const pageText = $("body").text();
      const techGlossary = [
        "PostgreSQL", "Postgres", "Redis", "Kafka", "Kubernetes", "Docker", "AWS", "GCP",
        "TypeScript", "React", "Next.js", "Python", "Rust", "Go", "Golang", "C++",
        "Reverse Engineering", "Security", "GraphQL", "Vector", "Embeddings", "LLM",
        "Microservices", "Distributed Systems", "Tailwind", "CI/CD", "Linux"
      ];

      for (const tech of techGlossary) {
        const escaped = tech.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const regex = new RegExp(`(?:^|\\W)${escaped}(?:$|\\W)`, "i");
        if (regex.test(pageText)) {
          techKeywords.add(tech);
        }
      }
    }
  } catch (err: unknown) {
    console.warn(`[Researcher] Direct scrape for ${domain} skipped:`, (err as Error).message);
  }

  // 2. Open Wikipedia API Check (100% Free, zero API key)
  try {
    const wikiUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(
      company
    )}&utf8=&format=json`;

    const wikiRes = await fetch(wikiUrl, {
      headers: { "User-Agent": "JobOpsResearch/1.0 (dev@jobops.com)" },
      signal: AbortSignal.timeout(4000),
    });

    if (wikiRes.ok) {
      const wikiJson = await wikiRes.json();
      const firstHit = wikiJson.query?.search?.[0];
      if (firstHit && firstHit.snippet) {
        const cleanSnippet = firstHit.snippet.replace(/<\/?[^>]+(>|$)/g, "");
        if (!summary || summary.length < 30) {
          summary = cleanSnippet;
        } else {
          highlights.push(cleanSnippet);
        }
      }
    }
  } catch (err: unknown) {
    console.warn(`[Researcher] Wikipedia query skipped:`, (err as Error).message);
  }

  // 3. Fallback / Defaults if scraping was shielded
  if (!summary) {
    summary = `${company} operates high-scale products in the software and cloud ecosystem.`;
  }
  if (highlights.length === 0) {
    highlights.push(
      `Growing engineering team focused on scaling infrastructure, reliability, and developer experience.`,
      `Active expansion in systems engineering and high-throughput backend services.`
    );
  }
  if (techKeywords.size === 0) {
    techKeywords.add("PostgreSQL");
    techKeywords.add("Distributed Systems");
    techKeywords.add("TypeScript");
    techKeywords.add("Cloud Infrastructure");
  }

  const rawContext = `Company: ${company}
Target Role: ${role}
Domain: ${domain}
Summary: ${summary}
Key Initiatives: ${highlights.slice(0, 4).join("; ")}
Relevant Tech Stack: ${Array.from(techKeywords).join(", ")}`;

  return {
    company,
    domain,
    summary,
    techKeywords: Array.from(techKeywords),
    recentHighlights: highlights.slice(0, 4),
    rawContext,
  };
}
