import Link from "next/link";
import {
  CheckCircle2,
  Circle,
  ExternalLink,
  AlertCircle,
} from "lucide-react";

interface StepProps {
  done: boolean;
  title: string;
  children: React.ReactNode;
}

function Step({ done, title, children }: StepProps) {
  return (
    <li className="flex gap-3">
      <div className="shrink-0 mt-0.5">
        {done ? (
          <CheckCircle2 className="w-5 h-5 text-emerald-500" />
        ) : (
          <Circle className="w-5 h-5 text-slate-300" />
        )}
      </div>
      <div className="flex-1">
        <div className="font-medium text-slate-900">{title}</div>
        <div className="text-sm text-slate-600 mt-1 space-y-1">{children}</div>
      </div>
    </li>
  );
}

export interface SetupState {
  databaseUrl: boolean;
  schemaApplied: boolean;
  aiKey: boolean;
  ntfy: boolean;
  email: boolean;
  cronSecret: boolean;
  siteUrl: boolean;
}

export default function SetupNeeded({
  state,
  errorMessage,
}: {
  state: SetupState;
  errorMessage?: string;
}) {
  return (
    <div className="max-w-3xl mx-auto py-8">
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="bg-gradient-to-br from-brand-500 to-brand-800 p-6 text-white">
          <h1 className="text-2xl font-bold">Welcome to Aventis Leads</h1>
          <p className="text-sm opacity-90 mt-1">
            One-time setup. Walk through the checklist below — should take 5–10 minutes.
          </p>
        </div>

        {errorMessage && (
          <div className="bg-amber-50 border-b border-amber-200 px-6 py-3 text-sm text-amber-800 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              <strong>Current error:</strong> {errorMessage}
            </div>
          </div>
        )}

        <ol className="p-6 space-y-6">
          <Step done={state.databaseUrl} title="1. Connect a Neon database">
            <ol className="list-decimal list-inside space-y-0.5">
              <li>
                Sign up at{" "}
                <a
                  href="https://neon.tech"
                  target="_blank"
                  rel="noreferrer"
                  className="text-brand-600 underline inline-flex items-center gap-1"
                >
                  neon.tech <ExternalLink className="w-3 h-3" />
                </a>{" "}
                (free, no card)
              </li>
              <li>Create a project — region <strong>AWS US East (N. Virginia)</strong></li>
              <li>
                On the project dashboard → <strong>Connection Details</strong> → toggle{" "}
                <strong>Pooled connection</strong> ON → copy the URL
              </li>
              <li>
                In Netlify → <strong>Site configuration → Environment variables → Add a variable</strong>
              </li>
              <li>
                Key: <code className="bg-slate-100 px-1.5 py-0.5 rounded">DATABASE_URL</code> · Value:
                paste the URL
              </li>
            </ol>
          </Step>

          <Step done={state.schemaApplied} title="2. Run the database schema">
            <ol className="list-decimal list-inside space-y-0.5">
              <li>
                In Neon, click your project → <strong>SQL Editor</strong> in the left sidebar
              </li>
              <li>
                Open <code className="bg-slate-100 px-1.5 py-0.5 rounded">db/schema.sql</code> from your GitHub
                repo, copy everything
              </li>
              <li>Paste into the SQL Editor → click <strong>Run</strong></li>
              <li>You should see &ldquo;Success&rdquo; — tables, indexes, and seed data are created</li>
            </ol>
          </Step>

          <Step done={state.aiKey} title="3. Add your free Gemini API key">
            <ol className="list-decimal list-inside space-y-0.5">
              <li>
                Go to{" "}
                <a
                  href="https://aistudio.google.com/apikey"
                  target="_blank"
                  rel="noreferrer"
                  className="text-brand-600 underline inline-flex items-center gap-1"
                >
                  aistudio.google.com/apikey <ExternalLink className="w-3 h-3" />
                </a>
              </li>
              <li>Click <strong>Create API key</strong> → copy it (starts with <code>AIza...</code>)</li>
              <li>
                In Netlify, add: <code className="bg-slate-100 px-1.5 py-0.5 rounded">GEMINI_API_KEY</code> = your key
              </li>
            </ol>
          </Step>

          <Step done={state.ntfy} title="4. Set up free push notifications">
            <ol className="list-decimal list-inside space-y-0.5">
              <li>Install the <strong>ntfy</strong> app on your phone (iOS or Android)</li>
              <li>
                Pick a long random string (your &ldquo;topic&rdquo;) — e.g. <code className="bg-slate-100 px-1.5 py-0.5 rounded">aventis-isaiah-x9k2p4qmnz</code>
              </li>
              <li>In the ntfy app → tap &ldquo;+&rdquo; → subscribe to that exact string</li>
              <li>
                In Netlify, add: <code className="bg-slate-100 px-1.5 py-0.5 rounded">NTFY_TOPIC</code> = the same string
              </li>
            </ol>
          </Step>

          <Step done={state.cronSecret} title="5. Protect the manual-run endpoint">
            <ul className="list-disc list-inside space-y-0.5">
              <li>
                Add to Netlify: <code className="bg-slate-100 px-1.5 py-0.5 rounded">CRON_SECRET</code> = any
                long random string (you choose)
              </li>
            </ul>
          </Step>

          <Step done={state.siteUrl} title="6. Set your site URL">
            <ul className="list-disc list-inside space-y-0.5">
              <li>
                Add to Netlify: <code className="bg-slate-100 px-1.5 py-0.5 rounded">NEXT_PUBLIC_SITE_URL</code> = your
                Netlify URL (e.g. <code>https://aventis-leads.netlify.app</code>) — so push notifications can link
                back here
              </li>
            </ul>
          </Step>

          <Step done={state.email} title="7. (Recommended) Add email backup notifications">
            <ol className="list-decimal list-inside space-y-0.5">
              <li>
                Sign up at{" "}
                <a
                  href="https://resend.com"
                  target="_blank"
                  rel="noreferrer"
                  className="text-brand-600 underline inline-flex items-center gap-1"
                >
                  resend.com <ExternalLink className="w-3 h-3" />
                </a>
              </li>
              <li>
                Add: <code className="bg-slate-100 px-1.5 py-0.5 rounded">RESEND_API_KEY</code>,{" "}
                <code className="bg-slate-100 px-1.5 py-0.5 rounded">NOTIFY_TO_EMAIL</code>,{" "}
                <code className="bg-slate-100 px-1.5 py-0.5 rounded">NOTIFY_FROM_EMAIL</code>
              </li>
            </ol>
          </Step>
        </ol>

        <div className="border-t border-slate-200 bg-slate-50 px-6 py-4 flex items-center justify-between">
          <div className="text-sm text-slate-600">
            After updating env vars: <strong>Deploys → Trigger deploy → Clear cache and deploy</strong>
          </div>
          <Link
            href="/api/health"
            className="text-sm text-brand-600 hover:underline font-medium"
          >
            Diagnostic →
          </Link>
        </div>
      </div>
    </div>
  );
}
