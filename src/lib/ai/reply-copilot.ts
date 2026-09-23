import { extractJson } from "./drafter";

export interface GenerateAiReplyParams {
  candidateName: string;
  company: string;
  role: string;
  recruiterMessage: string;
  recruiterFrom?: string | null;
  customContext?: string | null;
}

export interface GeneratedAiReply {
  suggestedSubject: string;
  suggestedBody: string;
  keyPointsCovered: string[];
  providerUsed: "nvidia" | "smart-copilot";
}

/**
 * Autonomous AI Recruiter Reply Copilot.
 * Analyzes incoming recruiter messages, screening questions, or interview invitations,
 * and synthesizes an optimal, authentic, high-conversion response.
 */
export async function generateAiReply(params: GenerateAiReplyParams): Promise<GeneratedAiReply> {
  const { candidateName, company, role, recruiterMessage, recruiterFrom, customContext } = params;

  const nvidiaApiKey = process.env.NVIDIA_API_KEY;

  const prompt = `You are a premier executive tech career agent assisting candidate ${candidateName}.
A recruiter or hiring manager from ${company} just responded to their application for the "${role}" role.

Recruiter/Sender: ${recruiterFrom || "Recruiter / Hiring Lead"}
Incoming Recruiter Message:
"${recruiterMessage}"

Candidate Info:
- Role: ${role}
- Strengths: Linux internals, distributed systems, Python, systems engineering, CI/CD automation, high availability.
- Scheduling: Flexible for phone screening or technical interview anytime Thursday/Friday morning or next Monday.
${customContext ? `- Additional Context: ${customContext}` : ""}

Task:
Draft the ideal reply from ${candidateName} to this recruiter.
Guidelines:
1. Tone: Enthusiastic, highly professional, direct, and respectful.
2. Directly answer any questions or scheduling requests made in their message.
3. Keep it brief (between 60 and 120 words). Avoid corporate waffle.
4. Output STRICTLY as JSON with keys "subject", "body", and "keyPointsCovered" (an array of 2-3 brief bullet strings).

JSON format:
{
  "subject": "Re: ...",
  "body": "Hi ...,\\n\\n...",
  "keyPointsCovered": ["Confirmed availability for technical screen", "Highlighted systems experience"]
}`;

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
          temperature: 0.7,
          max_tokens: 1024,
        }),
        signal: AbortSignal.timeout(6000),
      });

      if (res.ok) {
        const json = await res.json();
        const content = json.choices?.[0]?.message?.content;
        if (content) {
          const parsed = extractJson(content);
          if (parsed?.body) {
            return {
              suggestedSubject: parsed.subject || `Re: ${role} Opportunity - ${candidateName}`,
              suggestedBody: parsed.body,
              keyPointsCovered: Array.isArray(parsed.keyPointsCovered)
                ? parsed.keyPointsCovered
                : ["Enthusiastic confirmation", "Offered interview availability"],
              providerUsed: "nvidia",
            };
          }
        }
      }
    } catch (err) {
      console.warn("[Reply Copilot] NVIDIA NIM generation notice:", (err as Error).message);
    }
  }

  // Smart Contextual Fallback
  return {
    suggestedSubject: `Re: ${role} – ${candidateName} Follow-Up`,
    suggestedBody: `Hi there,\n\nThank you for getting back to me! I would be delighted to connect and discuss how my background in systems engineering and automation aligns with ${company}'s goals.\n\nI am available for a brief conversation this Thursday or Friday between 10:00 AM - 4:00 PM, or next Monday at your convenience. Please let me know what time works best on your calendar.\n\nLooking forward to speaking soon.\n\nBest regards,\n${candidateName}`,
    keyPointsCovered: [
      "Immediate acknowledgment of recruiter inquiry",
      "Explicit calendar availability proposed",
      "Reinforced enthusiasm for role",
    ],
    providerUsed: "smart-copilot",
  };
}
