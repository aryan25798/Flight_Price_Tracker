"use client";

import * as React from "react";
import { Sparkles } from "lucide-react";
import { AICopilotDrawer } from "./ai-copilot-drawer";
import type { Profile, AIScope } from "@/types/database";

export function AICopilotLauncher({
  profile,
  initialScope = "user",
}: {
  profile: Profile;
  initialScope?: AIScope;
}) {
  const [open, setOpen] = React.useState(false);

  // Listen for global custom events to open copilot with a prompt (e.g. from charts or search)
  React.useEffect(() => {
    function handleOpenCopilot(e: CustomEvent<{ prompt?: string; scope?: AIScope }>) {
      setOpen(true);
    }
    window.addEventListener("aerodrop:open-copilot" as any, handleOpenCopilot);
    return () => {
      window.removeEventListener("aerodrop:open-copilot" as any, handleOpenCopilot);
    };
  }, []);

  return (
    <>
      {/* Floating Action Button */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-5 right-5 z-40 flex items-center gap-2 rounded-full border border-sky-400/40 bg-slate-900/90 hover:bg-slate-900 px-4 py-2.5 text-xs font-bold text-sky-300 shadow-[0_0_20px_rgba(56,189,248,0.35)] backdrop-blur-md transition-all hover:scale-105 hover:shadow-[0_0_28px_rgba(56,189,248,0.55)] cursor-pointer focus:outline-none group"
        aria-label="Open AeroDrop AI Copilot"
        title="Open AeroDrop AI Copilot"
      >
        <div className="relative flex h-5 w-5 items-center justify-center rounded-full bg-sky-500/20 text-sky-400">
          <Sparkles className="h-3.5 w-3.5 transition-transform duration-300 group-hover:rotate-12" />
          <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_6px_rgba(52,211,153,0.8)]" />
        </div>
        <span className="tracking-tight">Ask AeroDrop AI</span>
      </button>

      {/* Global AI Copilot Slide-over Drawer */}
      <AICopilotDrawer
        profile={profile}
        isOpen={open}
        onClose={() => setOpen(false)}
        initialScope={initialScope}
      />
    </>
  );
}
