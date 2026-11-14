"use client";

import * as React from "react";
import { CopilotAvatar } from "./copilot-avatar";
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
  const [isHovered, setIsHovered] = React.useState(false);

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
      {/* Compact Floating Action Launcher (Non-Intrusive, Discrete 48px Circular Disc) */}
      <div className="fixed bottom-4 right-4 sm:bottom-5 sm:right-5 z-40 flex items-center select-none">
        {/* Subtle Minimalist Hover Tooltip (Only visible on hover, zero permanent screen clutter) */}
        {isHovered && !open && (
          <div className="hidden sm:block absolute right-14 whitespace-nowrap px-2.5 py-1 rounded-lg bg-slate-900/95 border border-sky-400/30 text-sky-200 text-xs font-semibold shadow-lg backdrop-blur-md animate-in fade-in duration-150 pointer-events-none">
            <span>AeroDrop Copilot</span>
          </div>
        )}

        {/* Compact Floating Circle Trigger */}
        <button
          type="button"
          onClick={() => setOpen(true)}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          className="group relative flex h-11 w-11 sm:h-12 sm:w-12 items-center justify-center rounded-full border border-sky-400/40 bg-slate-950/90 hover:bg-slate-900 shadow-[0_4px_20px_rgba(0,0,0,0.6),0_0_15px_rgba(56,189,248,0.25)] backdrop-blur-xl transition-all duration-200 hover:scale-105 hover:border-sky-300 hover:shadow-[0_6px_25px_rgba(0,0,0,0.7),0_0_24px_rgba(56,189,248,0.45)] cursor-pointer focus:outline-hidden"
          aria-label="Open AeroDrop AI Copilot"
          title="AeroDrop Copilot"
        >
          {/* Animated 3D Aviator Captain Pilot Avatar */}
          <CopilotAvatar
            size="md"
            floating={true}
            showStatusDot={true}
            isOnline={true}
            className="w-9 h-9 sm:w-10 sm:h-10"
          />
        </button>
      </div>

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
