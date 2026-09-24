"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Briefcase,
  Mail,
  Settings,
  Zap,
  LogOut,
  ExternalLink,
  FileText,
  Globe,
  Sparkles,
} from "lucide-react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { signOut } from "next-auth/react";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface SidebarProps {
  user?: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
  };
  isConnected?: boolean;
}

export default function Sidebar({ user, isConnected = false }: SidebarProps) {
  const pathname = usePathname();

  const routes = [
    { name: "Overview", icon: LayoutDashboard, path: "/dashboard" },
    { name: "AI Copilot", icon: Sparkles, path: "/dashboard/ai-chat", highlight: true },
    { name: "Find Jobs", icon: Globe, path: "/dashboard/search" },
    { name: "Pipeline", icon: Briefcase, path: "/dashboard/pipeline" },
    { name: "AI Resume", icon: FileText, path: "/dashboard/profile" },
    { name: "Templates", icon: Mail, path: "/dashboard/templates" },
    { name: "Settings", icon: Settings, path: "/dashboard/settings" },
  ];

  return (
    <aside className="w-52 bg-[#09090b] flex flex-col justify-between py-3.5 px-2.5 border-r border-zinc-800/70 h-screen sticky top-0 shrink-0 select-none">
      <div>
        {/* Brand Header - Compact */}
        <div className="flex items-center justify-between px-1.5 mb-4">
          <Link href="/dashboard" className="flex items-center gap-2.5 group">
            <div className="flex h-7 w-7 min-w-[28px] min-h-[28px] aspect-square items-center justify-center rounded-lg bg-gradient-to-tr from-indigo-500 to-violet-500 text-white shadow-md shadow-indigo-500/20 group-hover:scale-105 transition-transform shrink-0">
              <Zap className="h-3.5 w-3.5 fill-current" />
            </div>
            <div className="min-w-0">
              <span className="text-xs font-semibold tracking-tight text-white block truncate">
                JobOps CRM
              </span>
              <span className="text-[9px] uppercase font-semibold text-zinc-500 tracking-wider block">
                Workspace
              </span>
            </div>
          </Link>
        </div>

        {/* Navigation - Sleek Compact Items */}
        <nav className="flex flex-col gap-0.5">
          {routes.map((route) => {
            const isActive =
              route.path === "/dashboard"
                ? pathname === "/dashboard"
                : pathname.startsWith(route.path);

            return (
              <Link
                key={route.path}
                href={route.path}
                className={cn(
                  "flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-all duration-150",
                  isActive
                    ? "bg-zinc-800/90 text-white shadow-sm border border-zinc-700/50"
                    : "text-zinc-400 hover:bg-zinc-800/40 hover:text-zinc-100"
                )}
              >
                <route.icon
                  className={cn(
                    "h-3.5 w-3.5 shrink-0 transition-colors",
                    isActive ? "text-indigo-400" : "text-zinc-500"
                  )}
                />
                <span className="truncate flex-1">{route.name}</span>
                {route.highlight && (
                  <span className="text-[8px] font-mono uppercase px-1 py-0.2 rounded bg-indigo-500/20 text-indigo-300 font-bold border border-indigo-500/30">
                    AI
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Footer / Account / Gmail status - Compact */}
      <div className="flex flex-col gap-2">
        {/* Gmail API Status Pill */}
        <div className="rounded-lg border border-zinc-800/80 bg-zinc-900/30 p-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">
              Gmail Dispatch
            </span>
            <div className="flex items-center gap-1.5">
              <span
                className={cn(
                  "h-1.5 w-1.5 rounded-full",
                  isConnected ? "bg-emerald-400 shadow-sm shadow-emerald-400/50" : "bg-amber-400 animate-pulse"
                )}
              />
              <span
                className={cn(
                  "text-[10px] font-medium",
                  isConnected ? "text-emerald-400" : "text-amber-400"
                )}
              >
                {isConnected ? "Ready" : "Offline"}
              </span>
            </div>
          </div>
          {!isConnected && (
            <Link
              href="/dashboard/settings"
              className="mt-1.5 flex items-center justify-center gap-1 w-full rounded bg-zinc-800 hover:bg-zinc-700 px-2 py-1 text-[10px] font-medium text-zinc-200 transition-colors"
            >
              Connect OAuth <ExternalLink className="h-2.5 w-2.5" />
            </Link>
          )}
        </div>

        {/* User Card & Sign Out */}
        <div className="rounded-lg border border-zinc-800/80 bg-zinc-900/40 p-2 flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            {user?.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={user.image}
                alt={user.name || "User"}
                className="h-6 w-6 min-w-[24px] min-h-[24px] aspect-square rounded-full border border-zinc-700 shrink-0 object-cover"
              />
            ) : (
              <div className="h-6 w-6 min-w-[24px] min-h-[24px] aspect-square rounded-full bg-indigo-600/30 border border-indigo-500/30 text-indigo-300 font-bold text-[10px] flex items-center justify-center shrink-0">
                {user?.name?.[0]?.toUpperCase() || "U"}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-medium text-zinc-200 truncate leading-tight">
                {user?.name || "Khawar Ahemad"}
              </p>
              <p className="text-[9px] text-zinc-500 truncate leading-tight">
                {user?.email || "khawar@jobops.dev"}
              </p>
            </div>
          </div>

          <button
            onClick={() => signOut({ callbackUrl: "/" })}
            title="Sign Out"
            className="p-1 text-zinc-400 hover:text-red-400 hover:bg-zinc-800 rounded transition-colors shrink-0 ml-1"
          >
            <LogOut className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </aside>
  );
}
