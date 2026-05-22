"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, Loader2, ExternalLink, X } from "lucide-react";

interface SearchResult {
  id: string;
  company_name: string | null;
  person_name: string | null;
  intent_signal: string | null;
  source: string;
  lead_score: number;
  status: string;
  location: string | null;
  is_east_coast: boolean;
  research_summary?: string | null;
}

export default function GlobalSearch() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [activeIdx, setActiveIdx] = useState(0);

  // Keyboard: Cmd/Ctrl+K opens, Esc closes
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      } else if (e.key === "Escape" && open) {
        setOpen(false);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // Focus input when modal opens
  useEffect(() => {
    if (open) {
      setQ("");
      setResults([]);
      setActiveIdx(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // Search as you type (debounced)
  useEffect(() => {
    if (!open) return;
    if (q.trim().length < 2) {
      setResults([]);
      return;
    }
    setLoading(true);
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`, {
          signal: ctrl.signal,
        });
        if (res.ok) {
          const data = await res.json();
          setResults(data.results ?? []);
          setActiveIdx(0);
        }
      } catch {
        // aborted or failed; ignore
      } finally {
        setLoading(false);
      }
    }, 200);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [q, open]);

  // Arrow-key navigation + Enter
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!open) return;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIdx((i) => Math.min(results.length - 1, i + 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIdx((i) => Math.max(0, i - 1));
      } else if (e.key === "Enter" && results[activeIdx]) {
        e.preventDefault();
        router.push(`/leads/${results[activeIdx].id}`);
        setOpen(false);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, results, activeIdx, router]);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-md hover:border-slate-300 text-slate-500"
      >
        <Search className="w-4 h-4" />
        <span className="flex-1 text-left">Search leads</span>
        <kbd className="text-[10px] bg-slate-100 px-1.5 py-0.5 rounded font-mono">⌘K</kbd>
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm" onClick={() => setOpen(false)}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="max-w-xl mx-auto mt-24 bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden"
      >
        <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-100">
          <Search className="w-4 h-4 text-slate-400" />
          <input
            ref={inputRef}
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search company, person, signal, location..."
            className="flex-1 text-sm focus:outline-none"
          />
          {loading && <Loader2 className="w-4 h-4 animate-spin text-slate-400" />}
          <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-slate-600">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="max-h-96 overflow-y-auto">
          {q.length < 2 ? (
            <div className="p-6 text-center text-sm text-slate-500">
              Type at least 2 characters to search.
              <div className="mt-2 text-xs text-slate-400">
                Try: &quot;HVAC&quot;, &quot;agency&quot;, &quot;Boston&quot;, &quot;white label&quot;
              </div>
            </div>
          ) : results.length === 0 && !loading ? (
            <div className="p-6 text-center text-sm text-slate-500">No matches.</div>
          ) : (
            <ul>
              {results.map((r, i) => (
                <li key={r.id}>
                  <button
                    onClick={() => {
                      router.push(`/leads/${r.id}`);
                      setOpen(false);
                    }}
                    onMouseEnter={() => setActiveIdx(i)}
                    className={`w-full flex items-center gap-3 px-4 py-3 text-left transition ${
                      i === activeIdx ? "bg-brand-50" : "hover:bg-slate-50"
                    }`}
                  >
                    <span
                      className={`shrink-0 inline-flex items-center justify-center w-9 h-9 rounded text-white text-sm font-bold ${
                        r.lead_score >= 80
                          ? "bg-emerald-500"
                          : r.lead_score >= 65
                          ? "bg-brand-500"
                          : r.lead_score >= 45
                          ? "bg-amber-500"
                          : "bg-slate-400"
                      }`}
                    >
                      {r.lead_score}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <div className="text-sm font-medium text-slate-900 truncate">
                          {r.company_name || r.person_name || "Unknown"}
                        </div>
                        {r.is_east_coast && (
                          <span className="text-[10px] bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded">EC</span>
                        )}
                      </div>
                      <div className="text-xs text-slate-500 truncate">
                        {r.intent_signal ?? r.research_summary ?? r.location ?? r.source}
                      </div>
                    </div>
                    <ExternalLink className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="px-4 py-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
          <span>
            <kbd className="font-mono bg-slate-100 px-1 rounded">↑↓</kbd> navigate ·{" "}
            <kbd className="font-mono bg-slate-100 px-1 rounded">↵</kbd> open ·{" "}
            <kbd className="font-mono bg-slate-100 px-1 rounded">esc</kbd> close
          </span>
          <span>{results.length} results</span>
        </div>
      </div>
    </div>
  );
}
