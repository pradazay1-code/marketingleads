"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  LayoutDashboard,
  Users,
  Target,
  Activity,
  Settings,
  Zap,
  LogOut,
} from "lucide-react";
import GlobalSearch from "./GlobalSearch";

const NAV = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/leads", label: "Leads", icon: Users },
  { href: "/pipeline", label: "Pipeline", icon: Target },
  { href: "/research-queue", label: "Research Queue", icon: Activity },
  { href: "/settings", label: "Settings", icon: Settings },
];

export default function Sidebar({ authEnabled = false }: { authEnabled?: boolean }) {
  const pathname = usePathname();
  const [loggingOut, setLoggingOut] = useState(false);

  async function logout() {
    setLoggingOut(true);
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  return (
    <aside className="w-60 shrink-0 bg-white border-r border-slate-200 min-h-screen flex flex-col">
      <div className="px-5 py-6 border-b border-slate-200">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-500 to-brand-800 flex items-center justify-center">
            <Zap className="w-4 h-4 text-white" />
          </div>
          <div>
            <div className="font-bold text-slate-900 text-sm leading-tight">Aventis</div>
            <div className="text-xs text-slate-500 leading-tight">Leads</div>
          </div>
        </div>
      </div>

      <div className="px-3 py-3 border-b border-slate-100">
        <GlobalSearch />
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1">
        {NAV.map((item) => {
          const Icon = item.icon;
          const active =
            pathname === item.href ||
            (item.href !== "/" && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm transition ${
                active
                  ? "bg-brand-50 text-brand-700 font-medium"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              }`}
            >
              <Icon className="w-4 h-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="px-3 py-3 border-t border-slate-200 space-y-1">
        {authEnabled && (
          <button
            onClick={logout}
            disabled={loggingOut}
            className="flex w-full items-center gap-2 px-3 py-2 rounded-md text-sm text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition disabled:opacity-50"
          >
            <LogOut className="w-4 h-4" />
            {loggingOut ? "Signing out..." : "Sign out"}
          </button>
        )}
        <div className="px-3 py-1 text-xs text-slate-400">Always on · 4-hour cycles</div>
      </div>
    </aside>
  );
}
