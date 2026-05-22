import "./globals.css";
import type { Metadata } from "next";
import { headers } from "next/headers";
import Sidebar from "@/components/Sidebar";

export const metadata: Metadata = {
  title: "Aventis Leads",
  description: "Autonomous lead discovery for Aventis Marketing & AventisAI",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const h = await headers();
  const pathname = h.get("x-pathname") || "";
  const isLoginPage = pathname.startsWith("/login");
  const authEnabled = !!process.env.APP_PASSWORD;

  return (
    <html lang="en">
      <head>
        <link rel="stylesheet" href="https://rsms.me/inter/inter.css" />
      </head>
      <body>
        {isLoginPage ? (
          <>{children}</>
        ) : (
          <div className="min-h-screen flex">
            <Sidebar authEnabled={authEnabled} />
            <main className="flex-1 overflow-x-hidden">
              <div className="max-w-7xl mx-auto px-6 py-8">{children}</div>
            </main>
          </div>
        )}
      </body>
    </html>
  );
}
