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
  const [showGreetingBubble, setShowGreetingBubble] = React.useState(false);
  const [hasInteracted, setHasInteracted] = React.useState(false);

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

  // Show a gentle greeting bubble 3 seconds after page loads if user hasn't clicked yet
  React.useEffect(() => {
    const timer = setTimeout(() => {
      if (!hasInteracted && !open) {
        setShowGreetingBubble(true);
      }
    }, 3000);

    return () => clearTimeout(timer);
  }, [hasInteracted, open]);

  // Hide greeting bubble automatically after 6 seconds
  React.useEffect(() => {
    if (showGreetingBubble) {
      const hideTimer = setTimeout(() => {
        setShowGreetingBubble(false);
      }, 6000);
      return () => clearTimeout(hideTimer);
    }
  }, [showGreetingBubble]);

  function handleTriggerClick() {
    setHasInteracted(true);
    setShowGreetingBubble(false);
    setOpen(true);
  }

  return (
    <>
      {/* Floating Action Launcher Container */}
      <div className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-40 flex items-center select-none">
        {/* Animated Greeting Speech Bubble (Appears gently, responsive) */}
        {showGreetingBubble && !open && (
          <div className="hidden sm:flex items-center gap-1.5 mr-3 px-3.5 py-1.5 rounded-2xl rounded-tr-xs bg-slate-900/95 border border-sky-400/40 text-slate-200 text-xs font-semibold shadow-[0_8px_24px_rgba(0,0,0,0.5),0_0_15px_rgba(56,189,248,0.2)] backdrop-blur-md animate-in fade-in slide-in-from-right-3 duration-300">
            <span className="text-sky-400 font-bold">Hi!</span>
            <span>Need flight advice or fare radar?</span>
            <span className="text-amber-300">👋</span>
          </div>
        )}

        {/* Floating Action Button (Adaptive: Circular on mobile, Pill on desktop) */}
        <button
          type="button"
          onClick={handleTriggerClick}
          onMouseEnter={() => setShowGreetingBubble(true)}
          className="group relative flex items-center justify-center gap-2.5 rounded-full border border-sky-400/40 bg-slate-950/95 hover:bg-slate-900 p-2 sm:px-4 sm:py-2 text-xs font-bold text-sky-300 shadow-[0_4px_24px_rgba(0,0,0,0.6),0_0_20px_rgba(56,189,248,0.35)] backdrop-blur-xl transition-all duration-300 hover:scale-105 hover:border-sky-300 hover:shadow-[0_8px_32px_rgba(0,0,0,0.7),0_0_30px_rgba(56,189,248,0.55)] cursor-pointer focus:outline-hidden min-h-[48px] min-w-[48px]"
          aria-label="Open AeroDrop AI Copilot"
          title="Open AeroDrop AI Copilot"
        >
          {/* Animated Avatar with Waving Hand */}
          <div className="relative flex items-center justify-center">
            <CopilotAvatar
              size="sm"
              waving={true}
              floating={true}
              showStatusDot={true}
              isOnline={true}
              className="sm:w-9 sm:h-9"
            />
          </div>

          {/* Desktop Label (Hidden on small mobile screens to prevent clutter) */}
          <div className="hidden sm:flex flex-col text-left leading-tight pr-1">
            <span className="text-[10px] font-mono text-sky-400 font-bold uppercase tracking-wider">
              AeroDrop Copilot
            </span>
            <span className="text-xs font-extrabold text-white group-hover:text-sky-200 transition-colors">
              Ask AI Radar
            </span>
          </div>

          {/* Mobile Badge Pip */}
          <span className="sm:hidden absolute -top-1 -right-1 flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-3 w-3 bg-sky-400 border-2 border-slate-950" />
          </span>
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
