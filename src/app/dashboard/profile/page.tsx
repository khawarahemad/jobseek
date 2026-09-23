"use client";

import { useState, useEffect } from "react";
import {
  FileText,
  Upload,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Loader2,
  User,
  Briefcase,
  MapPin,
  Plus,
  Save,
  Terminal,
} from "lucide-react";

interface KeyProject {
  name: string;
  description: string;
  tech: string;
}

interface CandidateProfile {
  id?: string;
  fullName?: string | null;
  headline?: string | null;
  email?: string | null;
  phone?: string | null;
  githubUrl?: string | null;
  portfolioUrl?: string | null;
  skills: string[];
  keyProjects?: KeyProject[] | null;
  targetRoles: string[];
  preferredLocations: string[];
  remotePreference?: string | null;
  targetIndustries: string[];
  seniorityLevel?: string | null;
  customBio?: string | null;
}

export default function ProfilePage() {
  const [profile, setProfile] = useState<CandidateProfile>({
    fullName: "",
    headline: "",
    skills: [],
    targetRoles: [],
    preferredLocations: ["Remote / Global", "United States", "MENA", "India"],
    targetIndustries: ["Cloud Infrastructure", "Offensive Security", "Fintech / High Scale"],
    remotePreference: "Remote",
    seniorityLevel: "Junior / Mid",
  });

  const [isLoading, setIsLoading] = useState(true);
  const [isParsing, setIsParsing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [newSkillInput, setNewSkillInput] = useState("");
  const [suggestedQuestions, setSuggestedQuestions] = useState<string[]>([]);

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/profile/resume");
      const data = await res.json();
      if (data.profile) {
        setProfile({
          ...data.profile,
          skills: data.profile.skills || [],
          targetRoles: data.profile.targetRoles || [],
          preferredLocations: data.profile.preferredLocations || ["Remote / Global"],
          targetIndustries: data.profile.targetIndustries || [],
        });
      }
    } catch (err) {
      console.error("Failed to fetch profile:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);

    setIsParsing(true);
    setStatusMsg(null);

    try {
      const res = await fetch("/api/profile/resume", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to parse resume");

      setProfile(data.profile);
      setSuggestedQuestions(data.suggestedQuestions || []);
      setStatusMsg({ type: "success", text: "Resume parsed & profile synthesized via NVIDIA NIM!" });
    } catch (err: unknown) {
      setStatusMsg({ type: "error", text: (err as Error).message });
    } finally {
      setIsParsing(false);
    }
  };

  const handleAutoIngestLocalResume = async () => {
    setIsParsing(true);
    setStatusMsg(null);

    try {
      const res = await fetch("/api/profile/resume", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ parseLocalResume: true }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to parse local resume");

      setProfile(data.profile);
      setSuggestedQuestions(data.suggestedQuestions || []);
      setStatusMsg({
        type: "success",
        text: "Successfully ingested Khawar_Ahemad_Khan_Resume.pdf via NVIDIA NIM!",
      });
    } catch (err: unknown) {
      setStatusMsg({ type: "error", text: (err as Error).message });
    } finally {
      setIsParsing(false);
    }
  };

  const handleSaveProfile = async () => {
    setIsSaving(true);
    setStatusMsg(null);

    try {
      const res = await fetch("/api/profile/resume", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profile),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save profile");

      setStatusMsg({ type: "success", text: "Candidate profile and preferences saved!" });
      setTimeout(() => setStatusMsg(null), 3000);
    } catch (err: unknown) {
      setStatusMsg({ type: "error", text: (err as Error).message });
    } finally {
      setIsSaving(false);
    }
  };

  const addSkill = () => {
    if (!newSkillInput.trim()) return;
    if (!profile.skills.includes(newSkillInput.trim())) {
      setProfile({ ...profile, skills: [...profile.skills, newSkillInput.trim()] });
    }
    setNewSkillInput("");
  };

  const removeSkill = (skillToRemove: string) => {
    setProfile({
      ...profile,
      skills: profile.skills.filter((s) => s !== skillToRemove),
    });
  };

  return (
    <div className="flex h-full flex-col bg-[#09090b] text-zinc-100 overflow-y-auto">
      {/* Sleek, Compact Header */}
      <header className="border-b border-zinc-800/70 bg-[#09090b]/90 backdrop-blur-md px-4 sm:px-6 py-2.5 flex items-center justify-between sticky top-0 z-20 shrink-0">
        <div>
          <h1 className="text-xs sm:text-sm font-semibold text-white tracking-tight">AI Resume & Profile Studio</h1>
          <p className="text-[10px] text-zinc-400 mt-0.5">
            Calibrate the autonomous LinkedIn scraper and personalized outreach engine.
          </p>
        </div>

        <button
          onClick={handleSaveProfile}
          disabled={isSaving || isParsing}
          className="flex h-7 items-center gap-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 px-3 text-[11px] font-semibold text-white transition-all shadow-sm disabled:opacity-50"
        >
          {isSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
          Save Profile
        </button>
      </header>

      <div className="px-4 py-3 sm:px-6 sm:py-4 max-w-4xl mx-auto w-full flex flex-col gap-3.5">
        {statusMsg && (
          <div
            className={`flex items-center gap-2 rounded-lg p-2.5 text-xs ${
              statusMsg.type === "success"
                ? "bg-emerald-500/10 text-emerald-300 border border-emerald-500/30"
                : "bg-red-500/10 text-red-300 border border-red-500/30"
            }`}
          >
            {statusMsg.type === "success" ? (
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
            ) : (
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            )}
            <span>{statusMsg.text}</span>
          </div>
        )}

        {/* Resume Ingestion Section - Compact */}
        <section className="rounded-xl border border-zinc-800/80 bg-[#121217] p-3 sm:p-3.5 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 shrink-0">
              <FileText className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-xs font-semibold text-white">Ingest Candidate Resume</h2>
              <p className="text-[11px] text-zinc-400 mt-0.5 max-w-md">
                NVIDIA NIM extracts your core projects, systems depth, and technical skills.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
            <button
              onClick={handleAutoIngestLocalResume}
              disabled={isParsing}
              className="flex-1 sm:flex-none h-7 flex items-center justify-center gap-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 px-2.5 text-[11px] font-medium text-white transition-all disabled:opacity-50"
            >
              {isParsing ? (
                <>
                  <Loader2 className="h-3 w-3 animate-spin" /> Ingesting...
                </>
              ) : (
                <>
                  <Terminal className="h-3 w-3 text-indigo-400" /> Ingest Local PDF
                </>
              )}
            </button>

            <label className="flex-1 sm:flex-none h-7 flex items-center justify-center gap-1.5 rounded-lg border border-zinc-700 bg-[#09090b] hover:bg-zinc-800 px-2.5 text-[11px] font-medium text-zinc-200 cursor-pointer transition-colors">
              <Upload className="h-3 w-3" /> Upload PDF
              <input type="file" accept=".pdf" onChange={handleFileUpload} className="hidden" />
            </label>
          </div>
        </section>

        {/* AI Suggested Questions (Conversational Questionnaire) */}
        {suggestedQuestions.length > 0 && (
          <section className="rounded-xl border border-indigo-500/30 bg-indigo-500/10 p-3">
            <h3 className="text-[11px] font-semibold text-indigo-300 uppercase tracking-wider flex items-center gap-1 mb-1">
              <Sparkles className="h-3 w-3 text-indigo-400" /> AI Follow-Up Recommendations
            </h3>
            <ul className="list-disc list-inside text-[11px] text-zinc-300 space-y-0.5">
              {suggestedQuestions.map((q, i) => (
                <li key={i}>{q}</li>
              ))}
            </ul>
          </section>
        )}

        {/* Profile Attributes Grid - Compact */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {/* Identity & Headline */}
          <div className="rounded-xl border border-zinc-800/80 bg-[#121217] p-3 flex flex-col gap-2.5 shadow-sm">
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-zinc-300 flex items-center gap-1">
              <User className="h-3 w-3 text-indigo-400" /> Candidate Identity
            </h3>

            <div>
              <label className="text-[10px] font-medium text-zinc-400 block mb-0.5">Full Name</label>
              <input
                type="text"
                value={profile.fullName || ""}
                onChange={(e) => setProfile({ ...profile, fullName: e.target.value })}
                className="w-full h-7 rounded-lg border border-zinc-800 bg-[#09090b] px-2.5 text-xs text-white focus:border-zinc-700 focus:outline-none"
              />
            </div>

            <div>
              <label className="text-[10px] font-medium text-zinc-400 block mb-0.5">Headline</label>
              <input
                type="text"
                value={profile.headline || ""}
                onChange={(e) => setProfile({ ...profile, headline: e.target.value })}
                className="w-full h-7 rounded-lg border border-zinc-800 bg-[#09090b] px-2.5 text-xs text-white focus:border-zinc-700 focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] font-medium text-zinc-400 block mb-0.5">GitHub URL</label>
                <input
                  type="text"
                  value={profile.githubUrl || ""}
                  onChange={(e) => setProfile({ ...profile, githubUrl: e.target.value })}
                  className="w-full h-7 rounded-lg border border-zinc-800 bg-[#09090b] px-2 text-xs text-white focus:border-zinc-700 focus:outline-none"
                />
              </div>
              <div>
                <label className="text-[10px] font-medium text-zinc-400 block mb-0.5">Portfolio</label>
                <input
                  type="text"
                  value={profile.portfolioUrl || ""}
                  onChange={(e) => setProfile({ ...profile, portfolioUrl: e.target.value })}
                  className="w-full h-7 rounded-lg border border-zinc-800 bg-[#09090b] px-2 text-xs text-white focus:border-zinc-700 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Job Search Preferences */}
          <div className="rounded-xl border border-zinc-800/80 bg-[#121217] p-3 flex flex-col gap-2.5 shadow-sm">
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-zinc-300 flex items-center gap-1">
              <MapPin className="h-3 w-3 text-indigo-400" /> Search Preferences
            </h3>

            <div>
              <label className="text-[10px] font-medium text-zinc-400 block mb-0.5">Workplace Type</label>
              <select
                value={profile.remotePreference || "Remote"}
                onChange={(e) => setProfile({ ...profile, remotePreference: e.target.value })}
                className="w-full h-7 rounded-lg border border-zinc-800 bg-[#09090b] px-2 text-xs text-white focus:border-zinc-700 focus:outline-none"
              >
                <option value="Remote">Remote Only</option>
                <option value="Hybrid">Hybrid</option>
                <option value="Onsite">On-site</option>
                <option value="Any">Flexible / Any</option>
              </select>
            </div>

            <div>
              <label className="text-[10px] font-medium text-zinc-400 block mb-0.5">Regions</label>
              <input
                type="text"
                value={profile.preferredLocations.join(", ")}
                onChange={(e) =>
                  setProfile({
                    ...profile,
                    preferredLocations: e.target.value.split(",").map((s) => s.trim()).filter(Boolean),
                  })
                }
                placeholder="e.g. Remote / Global, US, Dubai"
                className="w-full h-7 rounded-lg border border-zinc-800 bg-[#09090b] px-2.5 text-xs text-white focus:border-zinc-700 focus:outline-none"
              />
            </div>

            <div>
              <label className="text-[10px] font-medium text-zinc-400 block mb-0.5">Seniority</label>
              <select
                value={profile.seniorityLevel || "Junior / Mid"}
                onChange={(e) => setProfile({ ...profile, seniorityLevel: e.target.value })}
                className="w-full h-7 rounded-lg border border-zinc-800 bg-[#09090b] px-2 text-xs text-white focus:border-zinc-700 focus:outline-none"
              >
                <option value="Internship">Internship</option>
                <option value="Junior / Mid">Junior / Mid Level</option>
                <option value="Senior">Senior</option>
                <option value="Staff / Lead">Staff / Lead</option>
              </select>
            </div>
          </div>
        </div>

        {/* Skills Tag Cloud - Compact */}
        <section className="rounded-xl border border-zinc-800/80 bg-[#121217] p-3 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-zinc-300 flex items-center gap-1">
              <Briefcase className="h-3 w-3 text-indigo-400" /> Extracted Skills ({profile.skills.length})
            </h3>
            <div className="flex items-center gap-1.5">
              <input
                type="text"
                placeholder="Add skill..."
                value={newSkillInput}
                onChange={(e) => setNewSkillInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addSkill()}
                className="h-6 rounded border border-zinc-800 bg-[#09090b] px-2 text-[11px] text-white placeholder:text-zinc-600 focus:outline-none"
              />
              <button
                type="button"
                onClick={addSkill}
                className="h-6 w-6 flex items-center justify-center rounded bg-zinc-800 text-zinc-300 hover:text-white"
              >
                <Plus className="h-3 w-3" />
              </button>
            </div>
          </div>

          <div className="flex flex-wrap gap-1">
            {profile.skills.map((skill, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1 rounded bg-zinc-800/80 border border-zinc-700/50 px-2 py-0.5 text-[10px] font-mono text-zinc-200"
              >
                {skill}
                <button
                  type="button"
                  onClick={() => removeSkill(skill)}
                  className="text-zinc-500 hover:text-red-400"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        </section>

        {/* Extracted Key Projects - Compact */}
        {profile.keyProjects && profile.keyProjects.length > 0 && (
          <section className="rounded-xl border border-zinc-800/80 bg-[#121217] p-3 shadow-sm">
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-zinc-300 mb-2 flex items-center gap-1">
              <Sparkles className="h-3 w-3 text-indigo-400" /> Synthesized Key Projects
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {profile.keyProjects.map((p, i) => (
                <div key={i} className="rounded-lg border border-zinc-800/70 bg-[#0c0c0f] p-2.5">
                  <span className="text-xs font-semibold text-white block">{p.name}</span>
                  <p className="text-[11px] text-zinc-400 mt-0.5 leading-relaxed">{p.description}</p>
                  <span className="inline-block mt-1 text-[9px] font-mono text-indigo-400">
                    Tech: {p.tech}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
