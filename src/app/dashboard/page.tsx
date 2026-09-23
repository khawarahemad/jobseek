import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ArrowUpRight, Mail, Users, CheckCircle, Sparkles, Building2, Clock } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await auth();
  const userId = session?.user?.id;

  // Fetch real data scoped strictly to this user
  const [jobs, recentLogs] = await Promise.all([
    prisma.job.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    }),
    prisma.outreachLog.findMany({
      where: {
        job: { userId },
      },
      include: {
        job: true,
      },
      orderBy: { sentAt: "desc" },
      take: 6,
    }),
  ]);

  const totalApplications = jobs.length;
  const emailedCount = jobs.filter((j) => j.status === "EMAILED").length;
  const repliedCount = jobs.filter((j) => j.status === "REPLIED").length;
  const interviewingCount = jobs.filter((j) => j.status === "INTERVIEWING").length;

  const stats = [
    {
      label: "Pipeline Leads",
      value: totalApplications.toString(),
      icon: Users,
      trend: `${jobs.filter((j) => j.status === "SOURCED").length} need outreach`,
    },
    {
      label: "Outreach Sent",
      value: emailedCount.toString(),
      icon: Mail,
      trend: `${repliedCount} responses received`,
    },
    {
      label: "Interview Loops",
      value: interviewingCount.toString(),
      icon: CheckCircle,
      trend: "Active stages",
    },
  ];

  return (
    <div className="px-4 py-3 sm:px-6 sm:py-4 max-w-7xl mx-auto w-full text-zinc-100 flex flex-col gap-4">
      {/* Sleek, Compact Header */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-800/70 pb-3">
        <div>
          <div className="inline-flex items-center gap-1.5 rounded-full border border-indigo-500/20 bg-indigo-500/10 px-2 py-0.5 text-[10px] font-medium text-indigo-300 mb-1">
            <Sparkles className="h-3 w-3" /> Multi-Tenant Workspace
          </div>
          <h1 className="text-base sm:text-lg font-bold tracking-tight text-white">
            Welcome, {session?.user?.name || "Khawar"}
          </h1>
          <p className="text-[11px] text-zinc-400">
            Autonomous job intelligence and cold email pipeline.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/dashboard/pipeline"
            className="flex h-7 items-center gap-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 px-3 text-xs font-semibold text-white shadow-sm transition-all"
          >
            Open Pipeline <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </header>

      {/* Metric Cards - Compact High-Density */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {stats.map((stat, i) => (
          <div
            key={i}
            className="group relative overflow-hidden rounded-xl border border-zinc-800/80 bg-[#121217] p-3.5 transition-all hover:border-zinc-700 hover:bg-[#15151c] shadow-sm"
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium uppercase tracking-wider text-zinc-400">
                {stat.label}
              </span>
              <div className="rounded-lg bg-zinc-800/80 p-1.5 text-indigo-400 border border-zinc-700/50">
                <stat.icon className="h-3.5 w-3.5" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-bold tracking-tight text-white">
                {stat.value}
              </span>
            </div>
            <div className="mt-1 text-[10px] text-zinc-500">{stat.trend}</div>
          </div>
        ))}
      </div>

      {/* Activity & Pipeline Preview Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Active Leads Table - Compact */}
        <div className="lg:col-span-2 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold text-zinc-200 flex items-center gap-1.5">
              <Building2 className="h-3.5 w-3.5 text-indigo-400" /> Active Job Leads
            </h2>
            <Link
              href="/dashboard/pipeline"
              className="text-[11px] text-indigo-400 hover:text-indigo-300 font-medium"
            >
              View all &rarr;
            </Link>
          </div>

          <div className="rounded-xl border border-zinc-800/80 bg-[#121217] overflow-hidden shadow-sm">
            {jobs.length === 0 ? (
              <div className="p-8 text-center">
                <p className="text-xs text-zinc-400 mb-2">No jobs added yet.</p>
                <Link
                  href="/dashboard/pipeline"
                  className="inline-flex items-center gap-1 text-xs font-medium text-indigo-400 hover:underline"
                >
                  Create your first lead in Pipeline
                </Link>
              </div>
            ) : (
              <table className="w-full text-left text-xs">
                <thead className="border-b border-zinc-800/80 bg-zinc-900/60 text-zinc-400 text-[10px] uppercase tracking-wider">
                  <tr>
                    <th className="px-3.5 py-2 font-medium">Company</th>
                    <th className="px-3.5 py-2 font-medium">Role</th>
                    <th className="px-3.5 py-2 font-medium">Status</th>
                    <th className="px-3.5 py-2 font-medium text-right">Created</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60 text-zinc-300">
                  {jobs.slice(0, 5).map((row) => (
                    <tr key={row.id} className="transition-colors hover:bg-zinc-800/30">
                      <td className="px-3.5 py-2.5 font-semibold text-white">
                        {row.company}
                      </td>
                      <td className="px-3.5 py-2.5 text-zinc-400">{row.title}</td>
                      <td className="px-3.5 py-2.5">
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.2 text-[10px] font-medium ${
                            row.status === "REPLIED"
                              ? "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                              : row.status === "INTERVIEWING"
                              ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                              : row.status === "EMAILED"
                              ? "bg-purple-500/10 text-purple-400 border border-purple-500/20"
                              : "bg-zinc-800 text-zinc-400 border border-zinc-700/50"
                          }`}
                        >
                          {row.status}
                        </span>
                      </td>
                      <td className="px-3.5 py-2.5 text-right text-zinc-500 font-mono text-[10px]">
                        {row.createdAt.toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                        })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Recent Gmail Outreach Dispatch Log - Compact */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold text-zinc-200 flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 text-indigo-400" /> Recent Outreach
            </h2>
          </div>

          <div className="rounded-xl border border-zinc-800/80 bg-[#121217] p-2.5 flex flex-col gap-2 shadow-sm">
            {recentLogs.length === 0 ? (
              <div className="py-6 text-center text-[11px] text-zinc-500">
                No emails dispatched yet. Trigger &quot;AI Draft&quot; on any pipeline lead to send your first email.
              </div>
            ) : (
              recentLogs.map((log) => (
                <div
                  key={log.id}
                  className="rounded-lg border border-zinc-800/60 bg-zinc-900/60 p-2 text-xs"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold text-xs text-white">
                      {log.job.company}
                    </span>
                    <span className="text-[9px] text-zinc-500 font-mono">
                      {log.sentAt.toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                      })}
                    </span>
                  </div>
                  <p className="text-zinc-400 text-[10px] truncate mb-1">
                    To: {log.sentTo || log.job.hrEmail || "Recruiter"}
                  </p>
                  {log.subject && (
                    <p className="text-zinc-300 font-medium text-[10px] line-clamp-1 italic bg-black/40 rounded px-1.5 py-0.5 border border-zinc-800/50">
                      &quot;{log.subject}&quot;
                    </p>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
