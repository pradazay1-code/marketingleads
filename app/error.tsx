"use client";

import { useEffect } from "react";
import { AlertCircle, ExternalLink } from "lucide-react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("App error:", error);
  }, [error]);

  const msg = error.message || "Unknown error";
  const isDbMissing = /DATABASE_URL not set/i.test(msg);
  const isDbSchemaMissing = /(relation .* does not exist|schema|column .* does not exist)/i.test(msg);
  const isDbConnection = /(ECONNREFUSED|getaddrinfo|connection|authentication|timeout)/i.test(msg);

  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="max-w-2xl w-full bg-white border border-red-200 rounded-xl p-8 shadow-sm">
        <div className="flex items-center gap-3 text-red-700">
          <AlertCircle className="w-6 h-6" />
          <h1 className="text-xl font-bold">Aventis Leads needs setup</h1>
        </div>

        {isDbMissing && (
          <div className="mt-5 space-y-3 text-sm text-slate-700">
            <p>
              <strong>DATABASE_URL is not set</strong> in your Netlify environment variables.
            </p>
            <ol className="list-decimal list-inside space-y-1">
              <li>
                Go to <a className="text-brand-600 underline" href="https://neon.tech" target="_blank" rel="noreferrer">neon.tech <ExternalLink className="inline w-3 h-3" /></a> and create a free project (region: US East)
              </li>
              <li>Open your Neon project → <strong>Connection Details</strong> → toggle <strong>Pooled connection</strong> ON → copy the URL</li>
              <li>In Netlify: <strong>Site configuration → Environment variables → Add a variable</strong></li>
              <li>Key: <code className="bg-slate-100 px-1.5 py-0.5 rounded">DATABASE_URL</code> · Value: paste the URL</li>
              <li>Trigger a redeploy: <strong>Deploys → Trigger deploy → Clear cache and deploy site</strong></li>
            </ol>
          </div>
        )}

        {isDbSchemaMissing && (
          <div className="mt-5 space-y-3 text-sm text-slate-700">
            <p>
              <strong>Your database is connected, but the tables don&apos;t exist yet.</strong> You need to run the schema.
            </p>
            <ol className="list-decimal list-inside space-y-1">
              <li>Open your <a className="text-brand-600 underline" href="https://console.neon.tech" target="_blank" rel="noreferrer">Neon dashboard <ExternalLink className="inline w-3 h-3" /></a></li>
              <li>Click your project → <strong>SQL Editor</strong> in the left sidebar</li>
              <li>Open <code className="bg-slate-100 px-1.5 py-0.5 rounded">db/schema.sql</code> from your GitHub repo</li>
              <li>Copy the entire file → paste into the Neon SQL Editor → click <strong>Run</strong></li>
              <li>Refresh this page</li>
            </ol>
          </div>
        )}

        {isDbConnection && !isDbMissing && !isDbSchemaMissing && (
          <div className="mt-5 space-y-3 text-sm text-slate-700">
            <p><strong>Cannot reach the database.</strong> Most common causes:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>DATABASE_URL is set but the value is wrong/truncated — copy it again from Neon</li>
              <li>Make sure you copied the <strong>Pooled connection</strong> string (not the direct one)</li>
              <li>The URL must end with <code className="bg-slate-100 px-1.5 py-0.5 rounded">?sslmode=require</code></li>
              <li>Your Neon project might be paused/deleted — check the Neon dashboard</li>
            </ul>
          </div>
        )}

        {!isDbMissing && !isDbSchemaMissing && !isDbConnection && (
          <div className="mt-5 space-y-3 text-sm text-slate-700">
            <p>Something went wrong rendering this page.</p>
            <pre className="bg-slate-50 border border-slate-200 rounded p-3 text-xs overflow-auto">{msg}</pre>
          </div>
        )}

        <div className="mt-6 flex items-center gap-3">
          <button
            onClick={reset}
            className="bg-brand-500 hover:bg-brand-600 text-white px-4 py-2 rounded-md text-sm font-medium"
          >
            Try again
          </button>
          <a
            href="/api/health"
            className="text-sm text-brand-600 hover:underline"
            target="_blank"
            rel="noreferrer"
          >
            Run full diagnostic →
          </a>
        </div>

        {error.digest && (
          <div className="mt-4 text-xs text-slate-400">
            Error ID: <code>{error.digest}</code>
          </div>
        )}
      </div>
    </div>
  );
}
