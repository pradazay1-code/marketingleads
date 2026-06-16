"use client";

import { useEffect, useState } from "react";
import { Download, CheckCircle2 } from "lucide-react";

/**
 * Chrome PWA install button.
 *
 * Chrome fires `beforeinstallprompt` once it confirms the site is
 * installable (HTTPS + valid manifest + valid icons). We capture that
 * event and let the user trigger install via our own button — much more
 * discoverable than the tiny browser-bar icon.
 *
 * If the app is already installed (display-mode: standalone) or the
 * browser doesn't fire the event (e.g., iOS Safari, Firefox), the button
 * silently hides itself.
 */

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export default function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    // Already installed? Hide.
    if (typeof window !== "undefined") {
      const standalone = window.matchMedia?.("(display-mode: standalone)").matches;
      // Safari iOS heuristic — not relevant on Chromebook, but harmless
      const iosStandalone = (window.navigator as unknown as { standalone?: boolean }).standalone;
      if (standalone || iosStandalone) {
        setInstalled(true);
        return;
      }
    }

    function onBeforeInstall(e: Event) {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    }
    function onInstalled() {
      setInstalled(true);
      setDeferred(null);
    }
    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  async function install() {
    if (!deferred) return;
    setPending(true);
    try {
      await deferred.prompt();
      const choice = await deferred.userChoice;
      if (choice.outcome === "accepted") setInstalled(true);
      setDeferred(null);
    } finally {
      setPending(false);
    }
  }

  if (installed) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-md text-xs bg-emerald-50 text-emerald-700">
        <CheckCircle2 className="w-3.5 h-3.5" />
        Installed
      </div>
    );
  }

  if (!deferred) {
    // Browser hasn't decided this is installable yet. Don't show a fake button.
    return null;
  }

  return (
    <button
      onClick={install}
      disabled={pending}
      className="flex items-center gap-2 w-full px-3 py-2 rounded-md text-sm bg-brand-50 text-brand-700 hover:bg-brand-100 transition disabled:opacity-50"
    >
      <Download className="w-4 h-4" />
      {pending ? "Installing..." : "Install on Chrome"}
    </button>
  );
}
