"use client";

import { useState } from "react";
import Link from "next/link";
import { signIn } from "next-auth/react";
import {
  Sparkles,
  Zap,
  Globe,
  Mail,
  Send,
  ShieldCheck,
  CheckCircle2,
  ArrowRight,
  Cpu,
  Layers,
  Search,
  ExternalLink,
  ChevronRight,
  TrendingUp,
  Inbox,
  Play,
} from "lucide-react";

export default function LandingPage() {
  const [demoState, setDemoState] = useState<"idle" | "researching" | "done">("idle");
  const [isDemoLoading, setIsDemoLoading] = useState(false);

  const runDemoResearch = () => {
    setDemoState("researching");
    setTimeout(() => {
      setDemoState("done");
    }, 1800);
  };

  const handleDemoSignIn = async () => {
    setIsDemoLoading(true);
    await signIn("demo", { callbackUrl: "/dashboard" });
  };

  const handleGoogleSignIn = () => {
    signIn("google", { callbackUrl: "/dashboard" });
  };

  return (
    <div className="min-h-screen bg-[#09090b] text-zinc-100 selection:bg-indigo-500/20 selection:text-indigo-200 overflow-x-hidden">
      {/* Background Radial Glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-[650px] overflow-hidden -z-10 pointer-events-none">
        <div className="absolute top-[-150px] left-1/2 -translate-x-1/2 w-[700px] h-[500px] bg-gradient-to-tr from-indigo-600/20 via-violet-600/15 to-transparent blur-[120px] rounded-full" />
      </div>

      {/* Navigation */}
      <header className="sticky top-0 z-50 backdrop-blur-md bg-[#09090b]/80 border-b border-zinc-800/60">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-500 to-violet-500 text-white shadow-md shadow-indigo-500/20 group-hover:scale-105 transition-transform">
              <Zap className="h-4 w-4 fill-current" />
            </div>
            <span className="font-bold text-base tracking-tight text-white">
              JobOps CRM
            </span>
            <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 ml-1">
              Multi-Tenant SaaS
            </span>
          </Link>

          <nav className="hidden md:flex items-center gap-8 text-xs font-medium text-zinc-400">
            <a href="#features" className="hover:text-white transition-colors">
              Features
            </a>
            <a href="#demo" className="hover:text-white transition-colors">
              Live Preview
            </a>
            <a href="#workflow" className="hover:text-white transition-colors">
              Autonomous Engine
            </a>
            <a href="#security" className="hover:text-white transition-colors">
              Privacy & OAuth
            </a>
          </nav>

          <div className="flex items-center gap-3">
            <button
              onClick={handleDemoSignIn}
              disabled={isDemoLoading}
              className="text-xs font-medium text-zinc-300 hover:text-white px-3 py-1.5 rounded-lg hover:bg-zinc-800/60 transition-colors"
            >
              {isDemoLoading ? "Launching..." : "Demo Workspace"}
            </button>
            <button
              onClick={handleGoogleSignIn}
              className="flex items-center gap-2 text-xs font-semibold bg-white hover:bg-zinc-200 text-black px-4 py-2 rounded-xl transition-all shadow-sm hover:scale-[1.02]"
            >
              Sign in with Google <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="pt-24 pb-16 px-6 max-w-5xl mx-auto text-center flex flex-col items-center">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 text-xs font-medium mb-8 animate-in fade-in slide-in-from-top-3">
          <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
          Autonomous AI Web-Crawler & Email Outreach Platform
        </div>

        <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-white leading-[1.15] max-w-4xl">
          Land Your Next Tech Role on{" "}
          <span className="bg-gradient-to-r from-indigo-400 via-violet-300 to-purple-400 bg-clip-text text-transparent">
            Autopilot
          </span>
          .
        </h1>

        <p className="mt-6 text-base sm:text-lg text-zinc-400 max-w-2xl leading-relaxed">
          JobOps CRM uses autonomous AI with live internet access to crawl target companies, analyze engineering architecture, and draft hyper-personalized cold outreach emails sent natively from your Gmail.
        </p>

        {/* CTA Buttons */}
        <div className="mt-10 flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto">
          <button
            onClick={handleGoogleSignIn}
            className="w-full sm:w-auto flex items-center justify-center gap-3 px-6 py-3.5 rounded-xl bg-white hover:bg-zinc-200 text-black text-sm font-semibold transition-all shadow-lg shadow-white/10 hover:scale-[1.02]"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
            Start Free with Google
          </button>

          <button
            onClick={handleDemoSignIn}
            disabled={isDemoLoading}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl border border-zinc-800 bg-zinc-900/60 hover:bg-zinc-800 text-zinc-200 text-sm font-semibold transition-all hover:scale-[1.02]"
          >
            <Play className="h-4 w-4 text-indigo-400 fill-current" />
            {isDemoLoading ? "Setting up Demo..." : "Try Live Demo (No Sign-in)"}
          </button>
        </div>

        {/* Trust Badges */}
        <div className="mt-12 flex flex-wrap items-center justify-center gap-6 text-xs text-zinc-500 font-medium">
          <span className="flex items-center gap-1.5">
            <CheckCircle2 className="h-4 w-4 text-emerald-400" /> Dispatches from verified Gmail API
          </span>
          <span className="flex items-center gap-1.5">
            <CheckCircle2 className="h-4 w-4 text-emerald-400" /> 100% Free Web-Scraping Engine
          </span>
          <span className="flex items-center gap-1.5">
            <CheckCircle2 className="h-4 w-4 text-emerald-400" /> Multi-Tenant Relational Isolation
          </span>
        </div>
      </section>

      {/* Interactive Live Demo Preview Card */}
      <section id="demo" className="py-12 px-6 max-w-5xl mx-auto">
        <div className="relative rounded-2xl border border-zinc-800/80 bg-[#101014] shadow-2xl p-6 sm:p-8 overflow-hidden">
          <div className="absolute top-0 right-0 p-3 bg-gradient-to-l from-indigo-500/10 to-transparent rounded-bl-xl text-[10px] font-mono text-indigo-400 border-l border-b border-indigo-500/20">
            Interactive AI Sandbox
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800/80 pb-5 mb-6">
            <div>
              <span className="text-xs font-semibold text-indigo-400 uppercase tracking-wider block">
                Target Lead Simulation
              </span>
              <h3 className="text-xl font-bold text-white mt-1">
                Supabase – Infrastructure Engineer
              </h3>
            </div>

            <button
              onClick={runDemoResearch}
              disabled={demoState === "researching"}
              className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 px-4 py-2 text-xs font-semibold text-white shadow-md shadow-indigo-600/20 transition-all disabled:opacity-50"
            >
              <Globe className="h-3.5 w-3.5" />
              {demoState === "researching"
                ? "Autonomous Web Crawling..."
                : demoState === "done"
                ? "Re-crawl & Re-synthesize"
                : "Simulate Web Research & Draft"}
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Left: Web Intelligence */}
            <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/30 p-5 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
                    <Search className="h-3.5 w-3.5 text-indigo-400" /> Autonomous Web Signals
                  </span>
                  <span className="text-[10px] font-mono text-zinc-500">
                    Source: supabase.com
                  </span>
                </div>

                {demoState === "researching" ? (
                  <div className="py-8 flex flex-col items-center justify-center gap-2 text-xs text-zinc-400">
                    <div className="h-5 w-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                    <span>Scraping company landing page & extracting tech stack...</span>
                  </div>
                ) : (
                  <>
                    <p className="text-xs text-zinc-300 leading-relaxed">
                      &quot;The Postgres Development Platform. Build production-grade apps with Postgres database, Realtime subscriptions, Edge Functions, and Vector embeddings.&quot;
                    </p>
                    <div className="mt-4 flex flex-wrap gap-1.5">
                      {["PostgreSQL", "Realtime", "Edge Functions", "Vector Embeddings", "Elixir", "Go"].map(
                        (tag, i) => (
                          <span
                            key={i}
                            className="rounded-md bg-zinc-800/80 border border-zinc-700/60 px-2 py-0.5 text-[11px] font-mono text-zinc-300"
                          >
                            {tag}
                          </span>
                        )
                      )}
                    </div>
                  </>
                )}
              </div>

              <div className="mt-4 pt-3 border-t border-zinc-800/60 text-[11px] text-zinc-500 flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                Zero API keys used: 100% Free Open Web Scraper
              </div>
            </div>

            {/* Right: AI Personalized Email Output */}
            <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/40 p-5 flex flex-col">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
                  <Mail className="h-3.5 w-3.5 text-indigo-400" /> Generated Outreach Pitch
                </span>
                <span className="text-[10px] text-indigo-400 font-mono">
                  Ready to Dispatch
                </span>
              </div>

              <div className="rounded-lg bg-[#09090b] border border-zinc-800 p-3 text-xs text-zinc-300 font-mono leading-relaxed space-y-2">
                <p className="text-zinc-500">
                  <strong className="text-zinc-400">Subject:</strong> Distributed Systems & Infra – Khawar (Supabase)
                </p>
                <div className="border-t border-zinc-800/80 pt-2 text-[11px] text-zinc-300 space-y-2">
                  <p>Hi Supabase Engineering Team,</p>
                  <p>
                    Reaching out because I&apos;ve been following your recent work around <strong>Realtime Postgres and Edge Functions</strong>. Given your focus on low-latency infrastructure and distributed databases, I wanted to see if your team is exploring talent for systems engineering.
                  </p>
                  <p>
                    My background is heavily focused on low-level systems, reverse engineering, and high-throughput backend services.
                  </p>
                  <p>Would love 5 minutes to chat if you&apos;re open. Best, Khawar</p>
                </div>
              </div>

              <div className="mt-3 flex items-center justify-between">
                <span className="text-[11px] text-zinc-500">1-Click Gmail Send</span>
                <button
                  onClick={handleDemoSignIn}
                  className="flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 font-semibold"
                >
                  Test with your leads &rarr;
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Feature Showcase Grid */}
      <section id="features" className="py-20 px-6 max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <span className="text-xs font-semibold text-indigo-400 uppercase tracking-wider">
            Engineered for Job Seekers & Tech Leaders
          </span>
          <h2 className="text-3xl sm:text-4xl font-bold text-white mt-2">
            Everything You Need to Out-Compete Generic Applicants
          </h2>
          <p className="text-zinc-400 text-sm mt-3 max-w-xl mx-auto">
            Traditional mass applications get tossed into ATS black holes. JobOps CRM helps you reach decision-makers with personalized, informed context.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Feature 1 */}
          <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/30 p-7 hover:border-zinc-700 transition-all group">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 mb-5 group-hover:scale-110 transition-transform">
              <Globe className="h-5 w-5" />
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">
              Autonomous Web Research
            </h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Crawls company landing pages, engineering blogs, and public repositories to extract actual technical initiatives and pain points. Zero paid scraping APIs needed.
            </p>
          </div>

          {/* Feature 2 */}
          <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/30 p-7 hover:border-zinc-700 transition-all group">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-violet-500/10 text-violet-400 border border-violet-500/20 mb-5 group-hover:scale-110 transition-transform">
              <Cpu className="h-5 w-5" />
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">
              NVIDIA NIM & LLM Synthesis
            </h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Synthesizes researched signals into concise, high-converting cold emails that sound like a real engineer, not a generic AI bot.
            </p>
          </div>

          {/* Feature 3 */}
          <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/30 p-7 hover:border-zinc-700 transition-all group">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 mb-5 group-hover:scale-110 transition-transform">
              <Mail className="h-5 w-5" />
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">
              Native Gmail API Dispatch
            </h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Dispatches straight from your authenticated Gmail address. Avoids cold email sender reputation traps and puts recruiter replies directly in your primary inbox.
            </p>
          </div>

          {/* Feature 4 */}
          <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/30 p-7 hover:border-zinc-700 transition-all group">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-violet-500/10 text-violet-400 border border-violet-500/20 mb-5 group-hover:scale-110 transition-transform">
              <Layers className="h-5 w-5" />
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">
              Interactive Kanban Pipeline
            </h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Organize opportunities across Sourced, Emailed, Replied, and Interviewing stages. Drag and drop leads, track reply dates, and stay organized.
            </p>
          </div>

          {/* Feature 5 */}
          <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/30 p-7 hover:border-zinc-700 transition-all group">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 mb-5 group-hover:scale-110 transition-transform">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">
              Multi-Tenant Data Isolation
            </h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Built on NextAuth v5 and PostgreSQL with relational user constraints. Your leads, templates, and Google credentials are fully isolated to your account.
            </p>
          </div>

          {/* Feature 6 */}
          <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/30 p-7 hover:border-zinc-700 transition-all group">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-violet-500/10 text-violet-400 border border-violet-500/20 mb-5 group-hover:scale-110 transition-transform">
              <TrendingUp className="h-5 w-5" />
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">
              High Response Rates
            </h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Personalized cold outreach achieves up to 4x higher recruiter responses than standard resumes submitted through generic application portals.
            </p>
          </div>
        </div>
      </section>

      {/* Workflow Section */}
      <section id="workflow" className="py-20 px-6 max-w-7xl mx-auto border-t border-zinc-800/60">
        <div className="text-center mb-16">
          <span className="text-xs font-semibold text-indigo-400 uppercase tracking-wider">
            Autonomous Pipeline Flow
          </span>
          <h2 className="text-3xl sm:text-4xl font-bold text-white mt-2">
            From Company Name to Primary Inbox in 30 Seconds
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            {
              step: "01",
              title: "Add Target Company",
              desc: "Enter company name (e.g. Supabase, Vercel, Trail of Bits) and target role.",
            },
            {
              step: "02",
              title: "Autonomous Web Crawl",
              desc: "Free web scraper searches engineering posts, product announcements, and tech stacks.",
            },
            {
              step: "03",
              title: "Personalized Pitch",
              desc: "AI drafter connects your skills directly to the company's real problems in < 120 words.",
            },
            {
              step: "04",
              title: "1-Click Gmail Send",
              desc: "Dispatches straight through your Google Account and logs the thread automatically.",
            },
          ].map((item, i) => (
            <div
              key={i}
              className="rounded-2xl border border-zinc-800/80 bg-zinc-900/30 p-6 relative flex flex-col justify-between"
            >
              <div>
                <span className="text-2xl font-mono font-bold text-indigo-500/40 block mb-3">
                  {item.step}
                </span>
                <h4 className="text-base font-semibold text-white mb-2">
                  {item.title}
                </h4>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  {item.desc}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Final Call to Action */}
      <section className="py-24 px-6 max-w-4xl mx-auto text-center border-t border-zinc-800/60">
        <div className="rounded-3xl border border-indigo-500/30 bg-gradient-to-b from-indigo-950/30 via-zinc-900/40 to-[#101014] p-10 sm:p-14 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-40 bg-indigo-500/20 blur-3xl rounded-full pointer-events-none" />

          <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
            Stop Sending Resumes into the Void.
          </h2>
          <p className="mt-4 text-sm text-zinc-400 max-w-xl mx-auto leading-relaxed">
            Launch your multi-tenant JobOps CRM workspace today. Connect your Gmail, crawl companies autonomously, and start booking technical interviews.
          </p>

          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              onClick={handleGoogleSignIn}
              className="flex items-center gap-2 rounded-xl bg-white hover:bg-zinc-200 text-black px-6 py-3 text-sm font-semibold transition-all shadow-md hover:scale-[1.02]"
            >
              Sign in with Google <ArrowRight className="h-4 w-4" />
            </button>
            <button
              onClick={handleDemoSignIn}
              disabled={isDemoLoading}
              className="flex items-center gap-2 rounded-xl border border-zinc-700 bg-zinc-800/60 hover:bg-zinc-800 text-zinc-200 px-6 py-3 text-sm font-semibold transition-all hover:scale-[1.02]"
            >
              <Play className="h-4 w-4 text-indigo-400 fill-current" />
              {isDemoLoading ? "Loading..." : "Launch Demo Workspace"}
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-zinc-800/60 py-8 px-6 text-center text-xs text-zinc-500">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="flex h-5 w-5 items-center justify-center rounded-lg bg-indigo-600 text-white text-[10px]">
              <Zap className="h-3 w-3 fill-current" />
            </div>
            <span className="font-semibold text-zinc-400">JobOps CRM Platform</span>
          </div>

          <p>© {new Date().getFullYear()} JobOps CRM. Multi-Tenant Autonomous Job Search SaaS.</p>

          <div className="flex items-center gap-6">
            <a href="#demo" className="hover:text-zinc-300 transition-colors">
              Live Demo
            </a>
            <a href="#features" className="hover:text-zinc-300 transition-colors">
              Features
            </a>
            <a href="#workflow" className="hover:text-zinc-300 transition-colors">
              Workflow
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
