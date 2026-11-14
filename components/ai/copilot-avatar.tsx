"use client";

import * as React from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";

export interface CopilotAvatarProps {
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  waving?: boolean;
  floating?: boolean;
  className?: string;
  showStatusDot?: boolean;
  isOnline?: boolean;
}

const SIZE_CLASSES = {
  xs: "w-6 h-6",
  sm: "w-8 h-8",
  md: "w-10 h-10",
  lg: "w-12 h-12",
  xl: "w-16 h-16",
};

export function CopilotAvatar({
  size = "md",
  floating = false,
  className,
  showStatusDot = false,
  isOnline = true,
}: CopilotAvatarProps) {
  return (
    <div
      className={cn(
        "relative inline-flex items-center justify-center shrink-0 rounded-full select-none",
        SIZE_CLASSES[size],
        className
      )}
    >
      {/* 3D Commercial Airline Captain Pilot Avatar */}
      <div
        className={cn(
          "relative w-full h-full rounded-full overflow-hidden border border-sky-400/40 bg-slate-950 shadow-[0_2px_12px_rgba(0,0,0,0.5),0_0_12px_rgba(56,189,248,0.2)]",
          floating && "animate-copilot-float"
        )}
      >
        <Image
          src="/images/copilot-pilot-avatar.jpg"
          alt="AeroDrop Copilot Pilot Captain"
          fill
          sizes="(max-width: 768px) 48px, 64px"
          priority
          className="object-cover object-center scale-105 transition-transform duration-300 hover:scale-110"
        />
        {/* Subtle glass reflection highlight */}
        <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-sky-500/10 via-transparent to-white/15 pointer-events-none" />
      </div>

      {/* Online Telemetry Status Dot */}
      {showStatusDot && (
        <span className="absolute -bottom-0.5 -right-0.5 flex h-3 w-3 z-10">
          {isOnline && (
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
          )}
          <span
            className={cn(
              "relative inline-flex rounded-full h-3 w-3 border-2 border-slate-950",
              isOnline
                ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.9)]"
                : "bg-slate-500"
            )}
          />
        </span>
      )}
    </div>
  );
}
