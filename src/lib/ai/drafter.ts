import { CompanyResearch } from "./researcher";

export interface DraftEmailParams {
  company: string;
  role: string;
  hrName?: string | null;
  candidateName: string;
  templateSubject?: string;
  templateBody?: string;
  research: CompanyResearch;
}

export interface GeneratedEmail {
  subject: string;
  body: string;
  researchedHighlights: string[];
  providerUsed: "nvidia" | "gemini" | "smart-template";
}

/**
 * Generates a hyper-personalized outreach email using NVIDIA NIM / LLM or smart synthesis
 */
export async function generatePersonalizedEmail(
  params: DraftEmailParams
): Promise<GeneratedEmail> {
  const { company, role, hrName, candidateName, templateSubject, templateBody, research } = params;
  const recipientGreeting = hrName ? `Hi ${hrName},` : `Hi ${company} Team,`;

  const nvidiaApiKey = process.env.NVIDIA_API_KEY;
  const geminiApiKey = process.env.GEMINI_API_KEY;

  const prompt = `You are a world-class career strategist and email copywriter.
Draft a concise, high-converting cold email from a candidate reaching out to an engineering leader or recruiter.

Candidate Name: ${candidateName}
Target Company: ${company}
Target Role: ${role}
Recipient: ${hrName || "Engineering / Hiring Team"}

Real-time Internet Research on ${company}:
- Summary: ${research.summary}
- Recent Initiatives: ${research.recentHighlights.join("; ")}
- Tech Stack Keywords: ${research.techKeywords.join(", ")}

${templateBody ? `Base Template to adapt:\n${templateBody}\n` : ""}

Rules:
1. NEVER start with "I hope this email finds you well" or any generic AI cliches.
2. The opening must directly reference something specific from the company research (e.g. recent product feature, infrastructure architecture, or tech focus).
3. Connect candidate's low-level systems, engineering, and problem-solving skills to the company's real challenges.
4. Keep the email body under 130 words. Punchy, authentic, and confident.
5. Provide the output in strictly valid JSON with keys "subject" and "body".

JSON format:
{
  "subject": "...",
  "body": "..."
}`;

  // 1. Try NVIDIA NIM API (OpenAI-compatible)
  if (nvidiaApiKey) {
    try {
      const model = process.env.NVIDIA_MODEL || "google/diffusiongemma-26b-a4b-it";
      const res = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${nvidiaApiKey}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          model,
          messages: [
            {
              role: "user",
              content: prompt,
            },
          ],
          chat_template_kwargs: {
            enable_thinking: true,
          },
          temperature: 1,
          top_p: 0.95,
          max_tokens: 1024,
        }),
        signal: AbortSignal.timeout(5000),
      });


      if (res.ok) {
        const json = await res.json();
        const content = json.choices?.[0]?.message?.content;
        if (content) {
          const parsed = extractJson(content);
          if (parsed?.subject && parsed?.body) {
            return {
              subject: parsed.subject,
              body: parsed.body,
              researchedHighlights: research.recentHighlights,
              providerUsed: "nvidia",
            };
          }
        }
      } else {
        console.warn("[Drafter] NVIDIA NIM API returned:", res.status, await res.text());
      }
    } catch (err: unknown) {
      console.warn("[Drafter] NVIDIA NIM API call failed:", (err as Error).message);
    }
  }

  // 2. Try Gemini API fallback if configured
  if (geminiApiKey) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiApiKey}`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: `${prompt}\nRespond with ONLY valid JSON.` }] }],
          generationConfig: { responseMimeType: "application/json" },
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) {
          const parsed = extractJson(text);
          if (parsed?.subject && parsed?.body) {
            return {
              subject: parsed.subject,
              body: parsed.body,
              researchedHighlights: research.recentHighlights,
              providerUsed: "gemini",
            };
          }
        }
      }
    } catch (err: unknown) {
      console.warn("[Drafter] Gemini fallback failed:", (err as Error).message);
    }
  }

  // 3. Intelligent Deterministic Synthesis (Works 100% out of the box with zero keys)
  const topInitiative = research.recentHighlights[0] || `${company}'s core developer platform`;
  const primaryTech = research.techKeywords.slice(0, 3).join(", ") || "distributed systems";

  const generatedSubject = templateSubject
    ? templateSubject
        .replace(/{{candidate_name}}/g, candidateName)
        .replace(/{{company}}/g, company)
    : `${role} – ${candidateName} (${company})`;

  let body = "";
  if (templateBody) {
    body = templateBody
      .replace(/{{hr_name}}/g, hrName || "Team")
      .replace(/{{company}}/g, company)
      .replace(/{{company_context}}/g, `${topInitiative} (${primaryTech})`)
      .replace(/{{candidate_name}}/g, candidateName);
  } else {
    body = `${recipientGreeting}

Reaching out because I've been tracking ${company}'s progress around ${topInitiative}. Given your emphasis on ${primaryTech}, I wanted to see if you have room for a dedicated ${role}.

My focus is on low-level systems engineering, reliability, and automated tooling. I build scalable backend architectures and autonomous tools designed to solve high-impact infrastructure challenges.

Would love to chat for 5 minutes if you're exploring talent for the team.

Best,
${candidateName}`;
  }

  return {
    subject: generatedSubject,
    body,
    researchedHighlights: research.recentHighlights,
    providerUsed: "smart-template",
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function extractJson(raw: string): any | null {
  try {
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
