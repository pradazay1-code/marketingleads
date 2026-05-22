"use client";

// Root-level error boundary: catches errors thrown in layout.tsx or
// during root rendering. Must define its own <html>/<body>.

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", padding: 40, margin: 0, background: "#f4f6fb" }}>
        <div
          style={{
            maxWidth: 640,
            margin: "60px auto",
            background: "white",
            padding: 32,
            borderRadius: 12,
            border: "1px solid #fecaca",
          }}
        >
          <h1 style={{ color: "#b91c1c", margin: 0 }}>Aventis Leads — startup error</h1>
          <p style={{ color: "#374151" }}>
            Something failed during root render. Most likely an environment variable is missing.
            Check Netlify → Site configuration → Environment variables.
          </p>
          <pre
            style={{
              background: "#f9fafb",
              border: "1px solid #e5e7eb",
              padding: 12,
              borderRadius: 6,
              fontSize: 12,
              overflow: "auto",
            }}
          >
            {error.message}
          </pre>
          <button
            onClick={reset}
            style={{
              marginTop: 12,
              background: "#5168fa",
              color: "white",
              border: "none",
              padding: "8px 16px",
              borderRadius: 6,
              cursor: "pointer",
            }}
          >
            Reload
          </button>
          <a
            href="/api/health"
            style={{ marginLeft: 12, color: "#5168fa", textDecoration: "none", fontSize: 14 }}
          >
            View diagnostic →
          </a>
          {error.digest && (
            <div style={{ marginTop: 16, fontSize: 11, color: "#94a3b8" }}>
              Error ID: <code>{error.digest}</code>
            </div>
          )}
        </div>
      </body>
    </html>
  );
}
