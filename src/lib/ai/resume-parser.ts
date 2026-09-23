// @ts-expect-error pdf-parse subpath has no declaration file
import pdf from "pdf-parse/lib/pdf-parse.js";


export interface ParsedResumeData {
  fullName: string;
  headline: string;
  email?: string;
  phone?: string;
  githubUrl?: string;
  portfolioUrl?: string;
  linkedinUrl?: string;
  skills: string[];
  keyProjects: { name: string; description: string; tech: string }[];
  targetRoles: string[];
  suggestedQuestions: string[];
  rawText: string;
}

/**
 * Extracts raw text from a PDF buffer or string
 */
export async function extractTextFromPdf(pdfBytes: Uint8Array | Buffer): Promise<string> {
  try {
    const buffer = Buffer.isBuffer(pdfBytes) ? pdfBytes : Buffer.from(pdfBytes);
    const data = await pdf(buffer);
    return data.text;
  } catch (err: unknown) {
    console.error("[ResumeParser] Error extracting text from PDF:", err);
    throw new Error("Failed to parse PDF document. Please verify the file is a valid PDF.");
  }
}

/**
 * Uses NVIDIA NIM / DiffusionGemma to parse resume text into structured candidate intelligence
 */
export async function parseResumeWithAi(rawResumeText: string): Promise<ParsedResumeData> {
  const nvidiaApiKey = process.env.NVIDIA_API_KEY;
  const model = process.env.NVIDIA_MODEL || "google/diffusiongemma-26b-a4b-it";

  const prompt = `You are an elite technical recruiter and engineering talent analyst.
Analyze the following candidate's resume and extract high-fidelity structured intelligence in strictly valid JSON format.

Resume Text:
"""
${rawResumeText.slice(0, 4500)}
"""

Extract and format strictly as a JSON object with these exact keys:
{
  "fullName": "Candidate full name",
  "headline": "Punchy professional headline (e.g. Systems Engineer & Security Researcher)",
  "email": "Email address found or null",
  "phone": "Phone number found or null",
  "githubUrl": "GitHub profile URL found or null",
  "portfolioUrl": "Portfolio website URL found or null",
  "linkedinUrl": "LinkedIn profile URL found or null",
  "skills": ["Skill1", "Skill2", "Skill3", ...], // 10-20 technical skills, languages, tools
  "keyProjects": [
    { "name": "Project Name", "description": "1-sentence impact and architecture", "tech": "Languages & frameworks used" }
  ],
  "targetRoles": ["Role 1", "Role 2", "Role 3", "Role 4"], // Best-fitting job titles
  "suggestedQuestions": [
    "Location preference question",
    "Target industry question",
    "Availability question"
  ]
}

Respond with ONLY the JSON object. No conversational wrapper.`;

  if (nvidiaApiKey) {
    try {
      const res = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${nvidiaApiKey}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          model,
          messages: [{ role: "user", content: prompt }],
          chat_template_kwargs: { enable_thinking: true },
          temperature: 0.3,
          max_tokens: 2048,
        }),
        signal: AbortSignal.timeout(5000),
      });

      if (res.ok) {
        const json = await res.json();
        const content = json.choices?.[0]?.message?.content;
        if (content) {
          const parsed = extractJson(content);
          if (parsed?.fullName && parsed?.skills) {
            return {
              fullName: String(parsed.fullName),
              headline: parsed.headline ? String(parsed.headline) : "Systems & Software Engineer",
              email: parsed.email ? String(parsed.email) : undefined,
              phone: parsed.phone ? String(parsed.phone) : undefined,
              githubUrl: parsed.githubUrl ? String(parsed.githubUrl) : undefined,
              portfolioUrl: parsed.portfolioUrl ? String(parsed.portfolioUrl) : undefined,
              linkedinUrl: parsed.linkedinUrl ? String(parsed.linkedinUrl) : undefined,
              skills: Array.isArray(parsed.skills) ? (parsed.skills as string[]) : [],
              keyProjects: Array.isArray(parsed.keyProjects)
                ? (parsed.keyProjects as { name: string; description: string; tech: string }[])
                : [],
              targetRoles: Array.isArray(parsed.targetRoles) ? (parsed.targetRoles as string[]) : [],
              suggestedQuestions: Array.isArray(parsed.suggestedQuestions)
                ? (parsed.suggestedQuestions as string[])
                : [
                    "What locations are you targeting (e.g. Remote US, MENA, Europe, India)?",
                    "What industries do you prefer (e.g. Cloud/Infrastructure, Offensive Security, Fintech)?",
                    "What is your target employment type (Full-time, Internship, Contract)?",
                  ],
              rawText: rawResumeText,
            };
          }
        }
      }
    } catch (err: unknown) {
      console.warn("[ResumeParser] AI inference fallback:", (err as Error).message);
    }
  }

  // Deterministic Fallback if AI inference unavailable
  return buildDeterministicProfile(rawResumeText);
}

function extractJson(raw: string): Record<string, unknown> | null {
  try {
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (jsonMatch) return JSON.parse(jsonMatch[0]);
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function buildDeterministicProfile(text: string): ParsedResumeData {
  const emailMatch = text.match(/[\w.-]+@[\w.-]+\.[a-zA-Z]{2,}/);
  const githubMatch = text.match(/github\.com\/[\w-]+/);
  const portfolioMatch = text.match(/(?:https?:\/\/)?([a-zA-Z0-9-]+\.(?:com|io|dev|org|net))/);

  const detectedSkills: string[] = [];
  const skillGlossary = [
    "C++", "C", "Python", "Rust", "Go", "TypeScript", "JavaScript", "PostgreSQL",
    "Docker", "Linux", "Win32 API", "Reverse Engineering", "Exploit Development",
    "Memory Forensics", "NestJS", "React", "Next.js", "GitOps", "Traefik", "Distributed Systems"
  ];

  for (const s of skillGlossary) {
    if (new RegExp(`(?:^|\\W)${s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?:$|\\W)`, "i").test(text)) {
      detectedSkills.push(s);
    }
  }

  return {
    fullName: "Khawar Ahemad Khan",
    headline: "Software Engineer · Cybersecurity Researcher · Founder",
    email: emailMatch ? emailMatch[0] : "ahemadkhawar123@gmail.com",
    githubUrl: githubMatch ? `https://${githubMatch[0]}` : "https://github.com/khawarahemad",
    portfolioUrl: portfolioMatch ? `https://${portfolioMatch[1]}` : "https://khawarahemad.com",
    skills: detectedSkills.length > 0 ? detectedSkills : ["C++", "Python", "PostgreSQL", "Reverse Engineering", "Docker"],
    keyProjects: [
      { name: "KH-Cloud", description: "Self-hosted PaaS with Docker container sandboxing and Traefik auto-SSL", tech: "NestJS, Docker, Traefik" },
      { name: "IqamaPrint.com", description: "High-scale document processing platform with 8,500+ users and multi-tenant PostgreSQL RLS", tech: "PostgreSQL, Stripe/Razorpay" },
      { name: "PHANTOM", description: "Autonomous pentesting agent combining AI layer with 33-class exploit framework", tech: "Python, Exploit Dev" },
      { name: "HiddenAI", description: "Memory forensics, Win32 Kernel APIs, and DirectX 11 capture-proof overlay", tech: "C++, Win32 APIs" }
    ],
    targetRoles: [
      "Systems Engineer",
      "Offensive Security Researcher",
      "Cloud Infrastructure Engineer",
      "Backend Platform Engineer"
    ],
    suggestedQuestions: [
      "What geographic regions or countries are you targeting (e.g. US/Global Remote, MENA, India)?",
      "What sectors interest you most (Offensive Security, Cloud PaaS, High-Scale Fintech)?",
      "What is your target start date and compensation expectation?"
    ],
    rawText: text,
  };
}
