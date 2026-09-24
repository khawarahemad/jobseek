import { auth, signIn } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Mail, Database, Cpu, Globe, CheckCircle2, User } from "lucide-react";

export default async function SettingsPage() {
  const session = await auth();
  const userId = session?.user?.id;

  const googleAccount = await prisma.account.findFirst({
    where: {
      userId,
      provider: "google",
    },
  });

  const isConnected =
    !!googleAccount?.refresh_token ||
    (!!process.env.GOOGLE_REFRESH_TOKEN && process.env.GOOGLE_REFRESH_TOKEN.length > 20);

  const hasNvidiaKey = !!process.env.NVIDIA_API_KEY && process.env.NVIDIA_API_KEY.length > 10;
  const nvidiaModel = process.env.NVIDIA_MODEL || "meta/llama-3.3-70b-instruct";

  return (
    <div className="flex h-full flex-col bg-[#09090b] text-zinc-100 overflow-y-auto">
      {/* Sleek, Compact Header */}
      <header className="border-b border-zinc-800/70 bg-[#09090b]/90 backdrop-blur-md px-4 sm:px-6 py-2.5 sticky top-0 z-20 shrink-0">
        <div>
          <h1 className="text-xs sm:text-sm font-semibold text-white tracking-tight">Platform Settings</h1>
          <p className="text-[10px] text-zinc-400 mt-0.5">
            Manage your integrations, Google OAuth credentials, and AI inference engine.
          </p>
        </div>
      </header>

      {/* Main Content Area - Lite & Compact */}
      <div className="px-4 py-3 sm:px-6 sm:py-4 max-w-4xl mx-auto w-full flex flex-col gap-4">
        {/* User Profile Card */}
        <section>
          <h2 className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mb-2">
            Account Profile
          </h2>
          <div className="rounded-xl border border-zinc-800/80 bg-[#121217] p-3 sm:p-3.5 flex items-center justify-between shadow-sm">
            <div className="flex items-center gap-3 min-w-0">
              {session?.user?.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={session.user.image}
                  alt={session.user.name || "User"}
                  className="h-9 w-9 rounded-full border border-zinc-700 object-cover shrink-0"
                />
              ) : (
                <div className="h-9 w-9 rounded-full bg-indigo-500/20 border border-indigo-500/40 text-indigo-300 font-bold flex items-center justify-center shrink-0">
                  <User className="h-4 w-4" />
                </div>
              )}
              <div className="min-w-0">
                <h3 className="font-semibold text-xs text-white truncate">{session?.user?.name || "User"}</h3>
                <p className="text-[11px] text-zinc-400 truncate">{session?.user?.email || "No email"}</p>
                <span className="inline-block mt-1 px-1.5 py-0.2 text-[9px] font-mono rounded bg-zinc-800 text-zinc-400 border border-zinc-700/60">
                  ID: {session?.user?.id?.slice(0, 16)}...
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* Integrations Section */}
        <section>
          <h2 className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mb-2">
            Integrations & APIs
          </h2>

          <div className="rounded-xl border border-zinc-800/80 bg-[#121217] divide-y divide-zinc-800/80 shadow-sm overflow-hidden">
            {/* Google OAuth & Gmail */}
            <div className="p-3 sm:p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start gap-3 min-w-0">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-800 text-indigo-400 border border-zinc-700/60 shrink-0 mt-0.5">
                  <Mail className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-semibold text-xs text-white">Google Workspace (Gmail API)</h3>
                  <p className="text-[11px] text-zinc-400 mt-0.5 max-w-lg leading-relaxed">
                    Connect your Gmail account via OAuth to send cold emails directly and track bounce/reply activity.
                  </p>

                  <div className="mt-1.5 flex items-center gap-1.5">
                    <div
                      className={`h-1.5 w-1.5 rounded-full ${
                        isConnected ? "bg-emerald-400 shadow-sm shadow-emerald-400/50" : "bg-amber-400 animate-pulse"
                      }`}
                    />
                    <span
                      className={`text-[10px] font-medium ${
                        isConnected ? "text-emerald-400" : "text-amber-400"
                      }`}
                    >
                      {isConnected ? "Connected & Ready to Send" : "Disconnected (OAuth Required)"}
                    </span>
                  </div>
                </div>
              </div>

              {!isConnected ? (
                <form
                  action={async () => {
                    "use server";
                    await signIn("google", { redirectTo: "/dashboard/settings" });
                  }}
                >
                  <button
                    type="submit"
                    className="rounded-lg bg-white hover:bg-zinc-200 px-3 py-1.5 text-[11px] font-semibold text-black transition-all shadow-sm text-center shrink-0"
                  >
                    Connect Gmail
                  </button>
                </form>
              ) : (
                <span className="text-[10px] font-medium text-emerald-400 flex items-center gap-1 shrink-0 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                  <CheckCircle2 className="h-3 w-3" /> Active
                </span>
              )}
            </div>

            {/* AI Inference (NVIDIA NIM) */}
            <div className="p-3 sm:p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start gap-3 min-w-0">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-800 text-indigo-400 border border-zinc-700/60 shrink-0 mt-0.5">
                  <Cpu className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-semibold text-xs text-white">AI Inference Engine (NVIDIA NIM)</h3>
                  <p className="text-[11px] text-zinc-400 mt-0.5 max-w-lg leading-relaxed">
                    Personalizes outreach emails using high-throughput open-weights models (Llama 3.3 70B) via NVIDIA NIM.
                  </p>

                  <div className="mt-1.5 flex items-center gap-1.5">
                    <div
                      className={`h-1.5 w-1.5 rounded-full ${
                        hasNvidiaKey ? "bg-emerald-400" : "bg-zinc-500"
                      }`}
                    />
                    <span className="text-[10px] text-zinc-400 font-medium">
                      {hasNvidiaKey
                        ? `NVIDIA NIM Active (${nvidiaModel})`
                        : "Smart Deterministic Fallback Active"}
                    </span>
                  </div>
                </div>
              </div>

              <span className="text-[10px] px-2 py-0.5 rounded-full bg-zinc-800/80 border border-zinc-700/60 text-zinc-300 font-mono shrink-0">
                {hasNvidiaKey ? "API Key Set" : "Zero-Key Fallback"}
              </span>
            </div>

            {/* Autonomous Web Research */}
            <div className="p-3 sm:p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start gap-3 min-w-0">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-800 text-indigo-400 border border-zinc-700/60 shrink-0 mt-0.5">
                  <Globe className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-semibold text-xs text-white">Autonomous Web Researcher</h3>
                  <p className="text-[11px] text-zinc-400 mt-0.5 max-w-lg leading-relaxed">
                    Live internet access: Crawls company landing pages, engineering blogs, and public knowledge bases.
                  </p>

                  <div className="mt-1.5 flex items-center gap-1.5">
                    <div className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                    <span className="text-[10px] font-medium text-emerald-400">
                      Cheerio + Open Web Scraping Active
                    </span>
                  </div>
                </div>
              </div>

              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium shrink-0">
                Unlimited Free
              </span>
            </div>

            {/* KH Cloud Database */}
            <div className="p-3 sm:p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start gap-3 min-w-0">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-800 text-indigo-400 border border-zinc-700/60 shrink-0 mt-0.5">
                  <Database className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-semibold text-xs text-white">KH Cloud PostgreSQL Database</h3>
                  <p className="text-[11px] text-zinc-400 mt-0.5 max-w-lg leading-relaxed">
                    Multi-tenant PostgreSQL database storing isolated jobs, templates, sessions, and outreach logs.
                  </p>

                  <div className="mt-1.5 flex items-center gap-1.5">
                    <div className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                    <span className="text-[10px] font-medium text-emerald-400">
                      Connected to jobseek_db
                    </span>
                  </div>
                </div>
              </div>

              <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 font-mono shrink-0">
                PostgreSQL 16
              </span>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
