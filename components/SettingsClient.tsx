"use client";

import { useState } from "react";
import type { Keyword } from "@/lib/types";
import { Play, Loader2, Trash2, Plus } from "lucide-react";

interface DbSource {
  id: string;
  name: string;
  type: string;
  enabled: boolean;
  config: Record<string, unknown> | null;
  last_run_at: string | null;
  last_success_at: string | null;
  last_error: string | null;
}

export default function SettingsClient({
  keywords: initialKeywords,
  sources: initialSources,
}: {
  keywords: Keyword[];
  sources: DbSource[];
}) {
  const [keywords, setKeywords] = useState(initialKeywords);
  const [sources, setSources] = useState(initialSources);
  const [newPhrase, setNewPhrase] = useState("");
  const [newCategory, setNewCategory] = useState("intent");
  const [newWeight, setNewWeight] = useState("7");
  const [secret, setSecret] = useState("");
  const [running, setRunning] = useState(false);
  const [runResult, setRunResult] = useState<string | null>(null);

  async function addKeyword() {
    if (!newPhrase.trim()) return;
    const res = await fetch("/api/keywords", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        phrase: newPhrase.trim(),
        category: newCategory,
        weight: parseInt(newWeight, 10) || 5,
      }),
    });
    if (res.ok) {
      const j = await res.json();
      setKeywords([j.keyword, ...keywords]);
      setNewPhrase("");
    }
  }

  async function removeKeyword(id: string) {
    if (!confirm("Remove this keyword?")) return;
    const res = await fetch(`/api/keywords/${id}`, { method: "DELETE" });
    if (res.ok) setKeywords(keywords.filter((k) => k.id !== id));
  }

  async function toggleSource(id: string, enabled: boolean) {
    const res = await fetch(`/api/sources/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: !enabled }),
    });
    if (res.ok) {
      setSources(sources.map((s) => (s.id === id ? { ...s, enabled: !enabled } : s)));
    }
  }

  async function runNow() {
    setRunning(true);
    setRunResult(null);
    const res = await fetch("/api/manual-run", {
      method: "POST",
      headers: { Authorization: `Bearer ${secret}` },
    });
    const j = await res.json();
    setRunResult(JSON.stringify(j, null, 2));
    setRunning(false);
  }

  const byCategory = keywords.reduce<Record<string, Keyword[]>>((acc, k) => {
    (acc[k.category] ??= []).push(k);
    return acc;
  }, {});

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Settings</h1>
        <p className="text-slate-500 mt-1">Tune the lead-gen system. Changes take effect on the next cycle.</p>
      </div>

      {/* Manual run */}
      <section className="bg-white rounded-xl border border-slate-200 p-6">
        <h2 className="font-semibold text-slate-900 mb-2">Run a cycle now</h2>
        <p className="text-sm text-slate-500 mb-4">
          Triggers the full 4-hour cycle on demand: fetch from all sources, research, score, notify.
          Requires the CRON_SECRET configured in env vars.
        </p>
        <div className="flex gap-2">
          <input
            type="password"
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
            placeholder="CRON_SECRET"
            className="flex-1 border border-slate-200 rounded-md px-3 py-2 text-sm"
          />
          <button
            onClick={runNow}
            disabled={running || !secret}
            className="bg-brand-500 text-white px-4 py-2 rounded-md text-sm flex items-center gap-2 hover:bg-brand-600 disabled:opacity-50"
          >
            {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            {running ? "Running..." : "Run now"}
          </button>
        </div>
        {runResult && (
          <pre className="mt-3 text-xs bg-slate-50 p-3 rounded-md overflow-auto max-h-60">
            {runResult}
          </pre>
        )}
      </section>

      {/* Sources */}
      <section className="bg-white rounded-xl border border-slate-200 p-6">
        <h2 className="font-semibold text-slate-900 mb-4">Lead sources</h2>
        <div className="space-y-2">
          {sources.map((s) => (
            <div
              key={s.id}
              className="flex items-center justify-between p-3 border border-slate-100 rounded-md"
            >
              <div>
                <div className="font-medium text-slate-900 text-sm">{s.name}</div>
                <div className="text-xs text-slate-500">
                  type: {s.type} ·{" "}
                  {s.last_success_at
                    ? `last success ${new Date(s.last_success_at).toLocaleString()}`
                    : "never run"}
                  {s.last_error && <span className="text-red-600 ml-2">⚠ {s.last_error}</span>}
                </div>
              </div>
              <label className="relative inline-flex cursor-pointer">
                <input
                  type="checkbox"
                  checked={s.enabled}
                  onChange={() => toggleSource(s.id, s.enabled)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-200 rounded-full peer-checked:bg-brand-500 after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-5 after:w-5 after:transition peer-checked:after:translate-x-5" />
              </label>
            </div>
          ))}
        </div>
      </section>

      {/* Keywords */}
      <section className="bg-white rounded-xl border border-slate-200 p-6">
        <h2 className="font-semibold text-slate-900 mb-4">Intent keywords</h2>
        <p className="text-sm text-slate-500 mb-4">
          When any of these phrases appear in a public post, that post becomes a candidate lead.
          Higher weight = stronger signal.
        </p>

        {/* Add new */}
        <div className="flex flex-wrap gap-2 mb-6 p-3 bg-slate-50 rounded-md">
          <input
            type="text"
            value={newPhrase}
            onChange={(e) => setNewPhrase(e.target.value)}
            placeholder='e.g. "need a new website"'
            className="flex-1 min-w-[200px] border border-slate-200 rounded-md px-3 py-2 text-sm"
          />
          <select
            value={newCategory}
            onChange={(e) => setNewCategory(e.target.value)}
            className="border border-slate-200 rounded-md px-3 py-2 text-sm"
          >
            <option value="intent">intent</option>
            <option value="pain">pain</option>
            <option value="service">service</option>
            <option value="launch">launch</option>
            <option value="hiring">hiring</option>
            <option value="complaint">complaint</option>
          </select>
          <input
            type="number"
            value={newWeight}
            onChange={(e) => setNewWeight(e.target.value)}
            min={1}
            max={10}
            className="w-20 border border-slate-200 rounded-md px-3 py-2 text-sm"
          />
          <button
            onClick={addKeyword}
            className="bg-brand-500 text-white px-3 py-2 rounded-md text-sm flex items-center gap-1 hover:bg-brand-600"
          >
            <Plus className="w-4 h-4" /> Add
          </button>
        </div>

        {Object.entries(byCategory).map(([cat, items]) => (
          <div key={cat} className="mb-4">
            <h3 className="text-xs uppercase font-medium text-slate-500 mb-2">{cat}</h3>
            <div className="flex flex-wrap gap-2">
              {items.map((k) => (
                <div
                  key={k.id}
                  className="group flex items-center gap-2 bg-slate-100 hover:bg-slate-200 rounded-full px-3 py-1 text-sm"
                >
                  <span>{k.phrase}</span>
                  <span className="text-xs bg-white px-1.5 rounded">{k.weight}</span>
                  <button
                    onClick={() => removeKeyword(k.id)}
                    className="opacity-0 group-hover:opacity-100 transition text-red-600 hover:text-red-800"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
