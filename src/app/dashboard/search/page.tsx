"use client";

import { useState, useEffect } from "react";
import {
  Search,
  Globe,
  Sparkles,
  ExternalLink,
  MapPin,
  Clock,
  CheckCircle2,
  Loader2,
  Building,
  Users,
  Plus,
  List,
  LayoutGrid,
  Bookmark,
  Check,
} from "lucide-react";
import HrOutreachDrawer, { DrawerJob } from "@/components/HrOutreachDrawer";

interface EnrichedJob {
  id: string;
  title: string;
  company: string;
  location: string;
  jobUrl: string;
  postedDate?: string;
  source: string;
  matchScore: number;
  matchedSkills: string[];
  alreadySaved?: boolean;
  existingJobId?: string;
  existingStatus?: string;
}

function getAvatarGradient(name: string) {
  const gradients = [
    "from-indigo-600/30 to-violet-600/30 text-indigo-300 border-indigo-500/30",
    "from-blue-600/30 to-cyan-600/30 text-blue-300 border-blue-500/30",
    "from-emerald-600/30 to-teal-600/30 text-emerald-300 border-emerald-500/30",
    "from-amber-600/30 to-orange-600/30 text-amber-300 border-amber-500/30",
    "from-purple-600/30 to-pink-600/30 text-purple-300 border-purple-500/30",
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return gradients[Math.abs(hash) % gradients.length];
}

export default function JobSearchPage() {
  const [keywords, setKeywords] = useState("Cyber Security");
  const [location, setLocation] = useState("Singapore, Remote");
  const [jobs, setJobs] = useState<EnrichedJob[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");
  const [minMatchFilter, setMinMatchFilter] = useState<number>(0);
  const [selectedJobForDrawer, setSelectedJobForDrawer] = useState<DrawerJob | null>(null);
  const [importingId, setImportingId] = useState<string | null>(null);

  useEffect(() => {
    handleSearch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSearch = async (kw = keywords, loc = location) => {
    setIsSearching(true);
    try {
      const res = await fetch("/api/jobs/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keywords: kw, location: loc }),
      });

      const data = await res.json();
      if (data.jobs) {
        setJobs(data.jobs);
      }
    } catch (err) {
      console.error("Job search error:", err);
    } finally {
      setIsSearching(false);
    }
  };

  const handleAutoDiscover = async () => {
    setIsSearching(true);
    try {
      const res = await fetch("/api/jobs/search?auto=true", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keywords, isAutoDiscover: true }),
      });

      const data = await res.json();
      if (data.jobs) {
        setJobs(data.jobs);
      }
    } catch (err) {
      console.error("Auto-discover error:", err);
    } finally {
      setIsSearching(false);
    }
  };

  const togglePresetLocation = (preset: string) => {
    const list = location
      .split(/[,;|]/)
      .map((l) => l.trim())
      .filter(Boolean);

    let nextList: string[];
    if (list.some((l) => l.toLowerCase() === preset.toLowerCase())) {
      nextList = list.filter((l) => l.toLowerCase() !== preset.toLowerCase());
    } else {
      nextList = [...list, preset];
    }
    const nextLoc = nextList.length > 0 ? nextList.join(", ") : "Remote";
    setLocation(nextLoc);
    handleSearch(keywords, nextLoc);
  };

  const handleOpenHrDrawer = async (job: EnrichedJob) => {
    let activeId = job.existingJobId;

    if (!activeId) {
      try {
        const res = await fetch("/api/jobs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            company: job.company,
            title: job.title,
            url: job.jobUrl,
            status: "SOURCED",
          }),
        });
        const saved = await res.json();
        if (saved.job) {
          activeId = saved.job.id;
          job.existingJobId = saved.job.id;
          job.alreadySaved = true;
        }
      } catch (err) {
        console.error("Failed to auto-import job:", err);
      }
    }

    setSelectedJobForDrawer({
      id: activeId || job.id,
      company: job.company,
      title: job.title,
      url: job.jobUrl,
      status: job.existingStatus || "SOURCED",
    });
  };

  const handleImportLead = async (job: EnrichedJob) => {
    setImportingId(job.id);
    try {
      const res = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company: job.company,
          title: job.title,
          url: job.jobUrl,
          status: "SOURCED",
        }),
      });
      const data = await res.json();
      if (res.ok && data.job) {
        job.alreadySaved = true;
        job.existingJobId = data.job.id;
        job.existingStatus = "SOURCED";
        setJobs([...jobs]);
      }
    } catch (err) {
      console.error("Import lead error:", err);
    } finally {
      setImportingId(null);
    }
  };

  const filteredJobs = jobs.filter((j) => (minMatchFilter ? j.matchScore >= minMatchFilter : true));

  return (
    <div className="flex h-full flex-col bg-[#09090b] text-zinc-100 overflow-y-auto">
      {/* Ultra-Slim Header Bar (h-11) with integrated search */}
      <header className="border-b border-zinc-800/70 bg-[#09090b]/90 backdrop-blur-md px-3 sm:px-4 py-2 sticky top-0 z-20 shrink-0">
        <div className="flex flex-wrap items-center justify-between gap-2">
          {/* Left: Title + Role Count + Filter Pills */}
          <div className="flex items-center gap-2 min-w-0">
            <h1 className="text-xs sm:text-sm font-semibold text-white tracking-tight shrink-0">
              Find Jobs
            </h1>

            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-zinc-800/80 text-zinc-400 border border-zinc-700/40 shrink-0">
              {filteredJobs.length} roles
            </span>

            {/* Quick Match Filter */}
            <div className="hidden sm:flex items-center gap-1 border-l border-zinc-800 pl-2 ml-1 text-[10px]">
              <button
                onClick={() => setMinMatchFilter(0)}
                className={`px-1.5 py-0.5 rounded transition-colors ${
                  minMatchFilter === 0 ? "bg-zinc-800 text-white font-medium" : "text-zinc-500 hover:text-zinc-300"
                }`}
              >
                All
              </button>
              <button
                onClick={() => setMinMatchFilter(85)}
                className={`px-1.5 py-0.5 rounded transition-colors ${
                  minMatchFilter === 85 ? "bg-emerald-500/20 text-emerald-400 font-medium" : "text-zinc-500 hover:text-zinc-300"
                }`}
              >
                ≥85% Match
              </button>
            </div>
          </div>

          {/* Right: Search Inputs + Actions + View Switcher */}
          <div className="flex items-center gap-1.5">
            {/* Keywords */}
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-zinc-500" />
              <input
                type="text"
                value={keywords}
                onChange={(e) => setKeywords(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                placeholder="Role / Title..."
                className="h-6.5 w-24 sm:w-32 md:w-40 focus:w-44 transition-all rounded-md border border-zinc-800 bg-zinc-900/90 pl-6 pr-2 text-[11px] text-zinc-200 placeholder:text-zinc-500 focus:border-indigo-500/50 focus:outline-none"
              />
            </div>

            {/* Location (Supports multiple comma-separated) */}
            <div className="relative">
              <MapPin className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-zinc-500" />
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                placeholder="Locations (comma-separated)..."
                title="Search multiple locations separated by commas (e.g. Singapore, Remote, London)"
                className="h-6.5 w-28 sm:w-36 md:w-48 focus:w-52 transition-all rounded-md border border-zinc-800 bg-zinc-900/90 pl-6 pr-2 text-[11px] text-zinc-200 placeholder:text-zinc-500 focus:border-indigo-500/50 focus:outline-none"
              />
            </div>

            {/* Search Trigger */}
            <button
              onClick={() => handleSearch()}
              disabled={isSearching}
              className="h-6.5 px-2.5 rounded-md bg-zinc-800 hover:bg-zinc-700 border border-zinc-700/60 text-[11px] font-medium text-zinc-200 hover:text-white transition-colors disabled:opacity-50"
            >
              {isSearching ? <Loader2 className="h-3 w-3 animate-spin" /> : "Search"}
            </button>

            {/* Auto-Discover AI Button */}
            <button
              onClick={handleAutoDiscover}
              disabled={isSearching}
              className="h-6.5 px-2.5 rounded-md bg-indigo-600 hover:bg-indigo-500 text-[11px] font-medium text-white flex items-center gap-1 transition-all shadow-sm disabled:opacity-50"
              title="Crawl LinkedIn across all target roles and regions autonomously"
            >
              <Sparkles className="h-3 w-3" />
              <span className="hidden sm:inline">Auto-Discover</span>
            </button>

            {/* View Mode Toggle: Compact List vs Grid */}
            <div className="flex items-center rounded-md border border-zinc-800 bg-zinc-900/90 p-0.5 ml-1">
              <button
                onClick={() => setViewMode("list")}
                title="Compact List View"
                className={`p-1 rounded transition-colors ${
                  viewMode === "list" ? "bg-zinc-800 text-white" : "text-zinc-500 hover:text-zinc-300"
                }`}
              >
                <List className="h-3 w-3" />
              </button>
              <button
                onClick={() => setViewMode("grid")}
                title="Grid View"
                className={`p-1 rounded transition-colors ${
                  viewMode === "grid" ? "bg-zinc-800 text-white" : "text-zinc-500 hover:text-zinc-300"
                }`}
              >
                <LayoutGrid className="h-3 w-3" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Region Quick Filters & Multi-Scan Indicators */}
      <div className="bg-[#0b0b0e] border-b border-zinc-800/60 px-3 sm:px-4 py-1.5 flex items-center justify-between gap-2 overflow-x-auto shrink-0 select-none">
        <div className="flex items-center gap-1.5 shrink-0 text-[10px]">
          <span className="text-zinc-500 font-medium flex items-center gap-1">
            <MapPin className="h-2.5 w-2.5 text-zinc-400" /> Multi-Scan:
          </span>
          {["Singapore", "Remote", "United States", "London", "Sydney", "Bengaluru", "Dubai"].map((preset) => {
            const isSelected = location.toLowerCase().includes(preset.toLowerCase());
            return (
              <button
                key={preset}
                type="button"
                onClick={() => togglePresetLocation(preset)}
                className={`px-1.5 py-0.5 rounded text-[10px] font-medium transition-colors border ${
                  isSelected
                    ? "bg-indigo-500/20 text-indigo-300 border-indigo-500/40"
                    : "bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-zinc-200 hover:bg-zinc-800/60"
                }`}
              >
                {isSelected ? "✓ " : "+ "}{preset}
              </button>
            );
          })}
        </div>

        <div className="text-[10px] text-zinc-500 shrink-0 hidden sm:block">
          {filteredJobs.length} roles found across {location.split(/[,;|]/).filter(Boolean).length} locations
        </div>
      </div>

      {/* Main Content Area - Ultra Compact */}
      <div className="px-3 py-2.5 sm:px-4 sm:py-3 max-w-7xl mx-auto w-full flex flex-col gap-2">
        {isSearching ? (
          <div className="flex flex-col items-center justify-center h-48 gap-2 text-xs text-zinc-500">
            <Loader2 className="h-4 w-4 animate-spin text-indigo-400" />
            <span className="text-[11px]">Crawling LinkedIn postings and computing skill matches...</span>
          </div>
        ) : filteredJobs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 gap-1 text-xs text-zinc-500">
            <span>No jobs matching criteria</span>
            <button
              onClick={() => {
                setMinMatchFilter(0);
                handleSearch();
              }}
              className="text-indigo-400 hover:underline text-[11px] mt-1"
            >
              Reset filters & refresh
            </button>
          </div>
        ) : viewMode === "list" ? (
          /* ULTRA-COMPACT LIST VIEW: Minimal height per row (~40px) */
          <div className="rounded-xl border border-zinc-800/80 bg-[#111116] divide-y divide-zinc-800/60 overflow-hidden shadow-sm">
            {filteredJobs.map((job, idx) => {
              const avatarClass = getAvatarGradient(job.company);
              const initialLetter = job.company.charAt(0).toUpperCase();

              return (
                <div
                  key={`${job.id}-${idx}`}
                  className="px-2.5 py-1.5 sm:px-3 sm:py-2 flex items-center justify-between gap-2.5 hover:bg-zinc-800/40 transition-colors group"
                >
                  {/* Left: Avatar + Company + Title */}
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <div
                      className={`flex h-5 w-5 min-w-[20px] min-h-[20px] aspect-square shrink-0 items-center justify-center rounded bg-gradient-to-br border text-[9px] font-bold ${avatarClass}`}
                    >
                      {initialLetter}
                    </div>

                    <div className="min-w-0 flex items-baseline gap-1.5 flex-wrap">
                      <span className="font-semibold text-xs text-zinc-100 group-hover:text-indigo-300 transition-colors truncate max-w-[130px] sm:max-w-[170px]">
                        {job.company}
                      </span>
                      <span className="text-[11px] text-zinc-400 truncate max-w-[180px] sm:max-w-[320px]">
                        {job.title}
                      </span>
                    </div>
                  </div>

                  {/* Middle: Match pill + Location + Skills */}
                  <div className="hidden sm:flex items-center gap-2 shrink-0">
                    <span
                      className={`text-[9px] font-mono font-bold px-1.5 py-0.2 rounded border ${
                        job.matchScore >= 85
                          ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                          : "bg-indigo-500/10 text-indigo-400 border-indigo-500/30"
                      }`}
                    >
                      {job.matchScore}%
                    </span>

                    <span className="text-[10px] text-zinc-500 truncate max-w-[100px] flex items-center gap-0.5">
                      <MapPin className="h-2.5 w-2.5" /> {job.location}
                    </span>

                    {/* Quick skills tags */}
                    <div className="hidden lg:flex items-center gap-1">
                      {job.matchedSkills?.slice(0, 3).map((s, i) => (
                        <span
                          key={i}
                          className="rounded bg-zinc-800/80 px-1.5 py-0.2 text-[9px] font-mono text-zinc-400 border border-zinc-700/40"
                        >
                          {s}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Right: Actions */}
                  <div className="flex items-center gap-1 shrink-0">
                    {job.jobUrl && (
                      <a
                        href={job.jobUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1 text-zinc-500 hover:text-white rounded hover:bg-zinc-800 transition-colors"
                        title="View job post"
                      >
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    )}

                    {!job.alreadySaved ? (
                      <button
                        onClick={() => handleImportLead(job)}
                        disabled={importingId === job.id}
                        className="h-5.5 px-2 rounded border border-zinc-700/80 bg-zinc-800/80 hover:bg-zinc-700 text-[10px] font-medium text-zinc-300 transition-colors"
                      >
                        {importingId === job.id ? "Saving..." : "Save"}
                      </button>
                    ) : (
                      <span className="h-5.5 px-1.5 rounded bg-zinc-800/50 text-[10px] text-zinc-500 font-mono flex items-center gap-0.5">
                        <Check className="h-2.5 w-2.5 text-emerald-400" /> Saved
                      </span>
                    )}

                    <button
                      onClick={() => handleOpenHrDrawer(job)}
                      className="h-5.5 px-2 rounded bg-indigo-600 hover:bg-indigo-500 text-[10px] font-semibold text-white flex items-center gap-1 transition-all shadow-sm"
                    >
                      <Users className="h-2.5 w-2.5" /> Apply
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* ULTRA-COMPACT GRID VIEW: Sleek ~110px cards */
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
            {filteredJobs.map((job, idx) => {
              const avatarClass = getAvatarGradient(job.company);
              const initialLetter = job.company.charAt(0).toUpperCase();

              return (
                <div
                  key={`${job.id}-${idx}`}
                  className="rounded-lg border border-zinc-800/80 bg-[#121217] p-2.5 flex flex-col justify-between hover:border-zinc-700 hover:bg-[#15151c] transition-all shadow-sm group"
                >
                  <div>
                    {/* Top Row: Avatar + Name + Match Badge */}
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <div
                          className={`flex h-5 w-5 min-w-[20px] min-h-[20px] aspect-square shrink-0 items-center justify-center rounded bg-gradient-to-br border text-[9px] font-bold ${avatarClass}`}
                        >
                          {initialLetter}
                        </div>
                        <span className="font-semibold text-xs text-zinc-100 group-hover:text-indigo-300 transition-colors truncate">
                          {job.company}
                        </span>
                      </div>

                      <span
                        className={`text-[9px] font-mono font-bold px-1.5 py-0.2 rounded border shrink-0 ${
                          job.matchScore >= 85
                            ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                            : "bg-indigo-500/10 text-indigo-400 border-indigo-500/30"
                        }`}
                      >
                        {job.matchScore}%
                      </span>
                    </div>

                    {/* Role Title */}
                    <h4 className="text-[11px] text-zinc-300 font-medium truncate mb-1">
                      {job.title}
                    </h4>

                    {/* Location & Source */}
                    <div className="flex items-center justify-between text-[10px] text-zinc-500">
                      <span className="truncate flex items-center gap-0.5">
                        <MapPin className="h-2.5 w-2.5" /> {job.location}
                      </span>
                      <span className="font-mono text-[9px] uppercase">{job.source}</span>
                    </div>
                  </div>

                  {/* Actions Footer */}
                  <div className="mt-2 pt-1.5 border-t border-zinc-800/60 flex items-center justify-between gap-1">
                    {job.jobUrl && (
                      <a
                        href={job.jobUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1 text-zinc-500 hover:text-white rounded hover:bg-zinc-800 transition-colors"
                        title="View job post"
                      >
                        <ExternalLink className="h-2.5 w-2.5" />
                      </a>
                    )}

                    <div className="flex items-center gap-1 ml-auto">
                      {!job.alreadySaved ? (
                        <button
                          onClick={() => handleImportLead(job)}
                          disabled={importingId === job.id}
                          className="h-5 px-1.5 rounded border border-zinc-700 bg-zinc-800 hover:bg-zinc-700 text-[9px] font-medium text-zinc-300 transition-colors"
                        >
                          {importingId === job.id ? "Saving..." : "Save"}
                        </button>
                      ) : (
                        <span className="text-[9px] text-zinc-500 font-mono">Saved</span>
                      )}

                      <button
                        onClick={() => handleOpenHrDrawer(job)}
                        className="h-5 flex items-center gap-0.5 rounded bg-indigo-600 hover:bg-indigo-500 px-2 text-[9px] font-semibold text-white transition-all shadow-sm"
                      >
                        <Users className="h-2 w-2" /> 5 HR
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 5-Contact HR Outreach Drawer */}
      {selectedJobForDrawer && (
        <HrOutreachDrawer
          job={selectedJobForDrawer}
          isOpen={!!selectedJobForDrawer}
          onClose={() => setSelectedJobForDrawer(null)}
          onJobUpdated={(updated) => {
            const match = jobs.find((j) => j.company === updated.company);
            if (match) {
              match.alreadySaved = true;
              match.existingJobId = updated.id;
              match.existingStatus = updated.status;
              setJobs([...jobs]);
            }
          }}
        />
      )}
    </div>
  );
}
