"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import {
  LayoutDashboard,
  Users,
  Target,
  Activity,
  Settings,
  Zap,
  LogOut,
  Menu,
  X,
} from "lucide-react";
import GlobalSearch from "./GlobalSearch";

const NAV = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/leads", label: "Leads", icon: Users },
  { href: "/pipeline", label: "Pipeline", icon: Target },
  { href: "/research-queue", label: "Research", icon: Activity },
  { href: "/settings", label: "Settings", icon: Settings },
];

export default function Sidebar({ authEnabled = false }: { authEnabled?: boolean }) {
  const pathname = usePathname();
  const [loggingOut, setLoggingOut] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  // close mobile menu on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  async function logout() {
    setLoggingOut(true);
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  const sidebarBody = (
    <>
      <div className="px-5 py-5 border-b border-slate-200 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-brand-500 to-brand-800 flex items-center justify-center">
            <Zap className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="font-bold text-slate-900 text-sm leading-tight">Aventis</div>
            <div className="text-xs text-slate-500 leading-tight">Leads CRM</div>
          </div>
        </Link>
        {/* Close button (mobile only) */}
        <button
          onClick={() => setMobileOpen(false)}
          className="lg:hidden p-2 -m-2 text-slate-500 hover:text-slate-900"
          aria-label="Close menu"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="px-3 py-3 border-b border-slate-100">
        <GlobalSearch />
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {NAV.map((item) => {
          const Icon = item.icon;
          const active =
            pathname === item.href ||
            (item.href !== "/" && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition touch-manipulation ${
                active
                  ? "bg-brand-50 text-brand-700 font-medium"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              }`}
            >
              <Icon className="w-5 h-5" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="px-3 py-3 border-t border-slate-200 space-y-1">
        {authEnabled && (
          <button
            onClick={logout}
            disabled={loggingOut}
            className="flex w-full items-center gap-3 px-3 py-2.5 rounded-md text-sm text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition disabled:opacity-50"
          >
            <LogOut className="w-5 h-5" />
            {loggingOut ? "Signing out..." : "Sign out"}
          </button>
        )}
        <div className="px-3 py-1 text-[11px] text-slate-400">Always-on · 4-hour cycles</div>
      </div>
    </>
  );

  return (
    <>
      {/* Mobile/small-screen top bar */}
      <header className="lg:hidden sticky top-0 z-30 bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between">
        <button
          onClick={() => setMobileOpen(true)}
          aria-label="Open menu"
          className="p-2 -m-2 text-slate-700 hover:text-brand-600 touch-manipulation"
        >
          <Menu className="w-5 h-5" />
        </button>
        <Link href="/" className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-md bg-gradient-to-br from-brand-500 to-brand-800 flex items-center justify-center">
            <Zap className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-sm text-slate-900">Aventis</span>
        </Link>
        <div className="w-9" /> {/* spacer for centering */}
      </header>

      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-60 shrink-0 bg-white border-r border-slate-200 min-h-screen flex-col sticky top-0 max-h-screen">
        {sidebarBody}
      </aside>

      {/* Mobile slide-in drawer */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-sm"
          onClick={() => setMobileOpen(false)}
        >
          <aside
            onClick={(e) => e.stopPropagation()}
            className="fixed left-0 top-0 bottom-0 w-72 max-w-[85vw] bg-white flex flex-col shadow-2xl"
          >
            {sidebarBody}
          </aside>
        </div>
      )}
    </>
  );
}
