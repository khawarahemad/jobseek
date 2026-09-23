import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { extractTextFromPdf, parseResumeWithAi } from "@/lib/ai/resume-parser";
import { uploadResumeToS3 } from "@/lib/s3";
import fs from "fs";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const profile = await prisma.candidateProfile.findUnique({
      where: { userId: session.user.id },
    });

    return NextResponse.json({ profile });
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

    const userId = session.user.id;
    let resumeText = "";
    let resumeBuffer: Buffer | null = null;
    let resumeFilename = "resume.pdf";

    const contentType = request.headers.get("content-type") || "";

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const file = formData.get("file") as File | null;

      if (!file) {
        return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
      }

      const bytes = await file.arrayBuffer();
      resumeBuffer = Buffer.from(bytes);
      resumeFilename = file.name || "resume.pdf";
      resumeText = await extractTextFromPdf(new Uint8Array(bytes));
    } else {
      const body = await request.json();
      if (body.parseLocalResume) {
        const localPath = "/Users/khawarahemad/Downloads/Khawar_Ahemad_Khan_Resume.pdf";
        if (fs.existsSync(localPath)) {
          resumeBuffer = fs.readFileSync(localPath);
          resumeFilename = "Khawar_Ahemad_Khan_Resume.pdf";
          resumeText = await extractTextFromPdf(new Uint8Array(resumeBuffer));
        } else {
          return NextResponse.json({ error: `Local resume not found at ${localPath}` }, { status: 404 });
        }
      } else if (body.rawResumeText) {
        resumeText = body.rawResumeText;
      } else {
        return NextResponse.json({ error: "Missing resume text or file" }, { status: 400 });
      }
    }

    if (!resumeText || resumeText.length < 50) {
      return NextResponse.json({ error: "Unable to extract meaningful text from resume." }, { status: 400 });
    }

    // 1. AI Analysis & Parsing with NVIDIA NIM
    const parsed = await parseResumeWithAi(resumeText);

    // 2. Upload resume PDF to S3 if we have a buffer
    let resumeS3Key: string | undefined;
    if (resumeBuffer) {
      try {
        resumeS3Key = await uploadResumeToS3(userId, "resume.pdf", resumeBuffer, "application/pdf");
        console.log(`[Resume] Uploaded to S3: ${resumeS3Key}`);
      } catch (s3Err) {
        // Non-fatal: log and continue without blocking profile save
        console.warn("[Resume] S3 upload failed (will use local fallback for emails):", s3Err);
      }
    }

    // 3. Upsert CandidateProfile in database
    const profile = await prisma.candidateProfile.upsert({
      where: { userId },
      create: {
        userId,
        fullName: parsed.fullName,
        headline: parsed.headline,
        email: parsed.email || session.user.email || undefined,
        phone: parsed.phone,
        githubUrl: parsed.githubUrl,
        portfolioUrl: parsed.portfolioUrl,
        rawResumeText: parsed.rawText,
        resumeS3Key: resumeS3Key,
        resumeFilename,
        skills: parsed.skills,
        keyProjects: parsed.keyProjects,
        targetRoles: parsed.targetRoles,
        preferredLocations: ["Remote / Global", "United States", "MENA / Dubai", "India"],
        targetIndustries: ["Cloud Infrastructure", "Offensive Security", "Fintech / High Scale"],
      },
      update: {
        fullName: parsed.fullName,
        headline: parsed.headline,
        email: parsed.email || undefined,
        phone: parsed.phone,
        githubUrl: parsed.githubUrl,
        portfolioUrl: parsed.portfolioUrl,
        rawResumeText: parsed.rawText,
        ...(resumeS3Key && { resumeS3Key, resumeFilename }),
        skills: parsed.skills,
        keyProjects: parsed.keyProjects,
        targetRoles: parsed.targetRoles,
      },
    });

    return NextResponse.json({
      success: true,
      profile,
      resumeStoredInS3: !!resumeS3Key,
      suggestedQuestions: parsed.suggestedQuestions,
    });
  } catch (err: unknown) {
    console.error("[API /api/profile/resume] Error:", err);
    return NextResponse.json(
      { error: (err as Error).message || "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const {
      headline,
      skills,
      targetRoles,
      preferredLocations,
      remotePreference,
      targetIndustries,
      seniorityLevel,
      customBio,
    } = body;

    const profile = await prisma.candidateProfile.upsert({
      where: { userId: session.user.id },
      create: {
        userId: session.user.id,
        headline,
        skills: skills || [],
        targetRoles: targetRoles || [],
        preferredLocations: preferredLocations || [],
        remotePreference: remotePreference || "Remote",
        targetIndustries: targetIndustries || [],
        seniorityLevel: seniorityLevel || "Junior / Mid",
        customBio,
      },
      update: {
        ...(headline && { headline }),
        ...(skills && { skills }),
        ...(targetRoles && { targetRoles }),
        ...(preferredLocations && { preferredLocations }),
        ...(remotePreference && { remotePreference }),
        ...(targetIndustries && { targetIndustries }),
        ...(seniorityLevel && { seniorityLevel }),
        ...(customBio !== undefined && { customBio }),
      },
    });

    return NextResponse.json({ success: true, profile });
  } catch (err: unknown) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
