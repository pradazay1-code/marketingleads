"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Lock, Zap } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const params = useSearchParams();
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (res.ok) {
        const next = params.get("next") || "/";
        router.push(next);
      } else {
        const data = await res.json().catch(() => ({ error: "login failed" }));
        setError(data.error === "invalid_password" ? "Wrong password" : "Login failed");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm bg-white rounded-xl border border-slate-200 shadow-sm p-8">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-brand-500 to-brand-800 flex items-center justify-center">
            <Zap className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="font-bold text-slate-900">Aventis Leads</div>
            <div className="text-xs text-slate-500">CRM access</div>
          </div>
        </div>
        <h1 className="text-xl font-semibold text-slate-900 mt-6">Sign in</h1>
        <p className="text-sm text-slate-500 mt-1">Enter the password you set in APP_PASSWORD.</p>

        <form onSubmit={submit} className="mt-6 space-y-3">
          <div className="relative">
            <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              autoFocus
              required
              className="w-full pl-9 pr-3 py-2.5 border border-slate-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-md px-3 py-2">
              {error}
            </div>
          )}
          <button
            type="submit"
            disabled={loading || !password}
            className="w-full bg-brand-500 hover:bg-brand-600 text-white py-2.5 rounded-md text-sm font-medium disabled:opacity-50"
          >
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </form>

        <div className="mt-6 text-xs text-slate-400 leading-relaxed">
          If you haven&apos;t set <code>APP_PASSWORD</code> in Netlify env vars, the site is open
          to anyone with the URL. Set it to lock the CRM down.
        </div>
      </div>
    </div>
  );
}
