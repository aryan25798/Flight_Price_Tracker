"use client";

import * as React from "react";
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
  waving = true,
  floating = false,
  className,
  showStatusDot = false,
  isOnline = true,
}: CopilotAvatarProps) {
  return (
    <div className={cn("relative inline-flex items-center justify-center shrink-0", SIZE_CLASSES[size], className)}>
      <svg
        viewBox="0 0 64 64"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={cn(
          "w-full h-full overflow-visible select-none drop-shadow-md",
          floating && "animate-copilot-float"
        )}
        aria-hidden="true"
      >
        <defs>
          {/* Ambient Head & Helmet Gradient */}
          <linearGradient id="copilotHelmetGrad" x1="16" y1="12" x2="48" y2="44" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#1e293b" />
            <stop offset="60%" stopColor="#0f172a" />
            <stop offset="100%" stopColor="#0284c7" />
          </linearGradient>

          {/* Visor Deep Gradient */}
          <linearGradient id="copilotVisorGrad" x1="18" y1="21" x2="46" y2="33" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#021526" />
            <stop offset="100%" stopColor="#082f49" />
          </linearGradient>

          {/* Flight Suit Gradient */}
          <linearGradient id="copilotSuitGrad" x1="16" y1="46" x2="48" y2="60" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#0f172a" />
            <stop offset="100%" stopColor="#0369a1" />
          </linearGradient>

          {/* Glowing Eyes Filter */}
          <filter id="copilotGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="1.2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* 1. Ambient Circular Backdrop / Halo */}
        <circle cx="32" cy="32" r="28" fill="#040916" stroke="rgba(56, 189, 248, 0.25)" strokeWidth="1.2" />

        {/* 2. Pilot Flight Suit & Shoulders */}
        <path
          d="M16 60 C16 48 23 45 32 45 C41 45 48 48 48 60"
          fill="url(#copilotSuitGrad)"
          stroke="#38bdf8"
          strokeWidth="1"
          strokeOpacity="0.4"
        />
        {/* Collar & Tech Zipper */}
        <path d="M32 45 L32 60" stroke="#38bdf8" strokeWidth="1.5" strokeOpacity="0.9" />
        <path d="M26 46 L32 52 L38 46" fill="none" stroke="#0284c7" strokeWidth="1.2" />

        {/* 3. Left Arm Resting */}
        <path
          d="M20 48 Q15 53 14 59"
          fill="none"
          stroke="#0f172a"
          strokeWidth="4"
          strokeLinecap="round"
        />

        {/* 4. Helmet Outer Shell */}
        <ellipse
          cx="32"
          cy="28"
          rx="18"
          ry="17"
          fill="url(#copilotHelmetGrad)"
          stroke="#38bdf8"
          strokeWidth="1.5"
          strokeOpacity="0.6"
        />

        {/* Helmet Top Aero Fin & Wings Crest */}
        <path d="M31 11 L33 11 L33 15 L31 15 Z" fill="#38bdf8" />
        <path d="M28 16 L32 14 L36 16 L32 17 Z" fill="#f59e0b" />
        <path d="M25 16 C27 15 29 15.5 31 16" stroke="#f59e0b" strokeWidth="1" fill="none" strokeLinecap="round" />
        <path d="M39 16 C37 15 35 15.5 33 16" stroke="#f59e0b" strokeWidth="1" fill="none" strokeLinecap="round" />

        {/* 5. Headset Comm Units */}
        {/* Left Ear Comm */}
        <rect x="12" y="24" width="4" height="9" rx="2" fill="#0b1329" stroke="#38bdf8" strokeWidth="1" />
        {/* Right Ear Comm */}
        <rect x="48" y="24" width="4" height="9" rx="2" fill="#0b1329" stroke="#38bdf8" strokeWidth="1" />
        {/* Boom Mic */}
        <path d="M14 31 Q20 38 27 36" fill="none" stroke="#94a3b8" strokeWidth="1.2" strokeLinecap="round" />
        <circle cx="27" cy="36" r="1.5" fill="#38bdf8" />

        {/* 6. Dark Glossy Visor */}
        <path
          d="M18 24 C18 19 46 19 46 24 C46 34 18 34 18 24 Z"
          fill="url(#copilotVisorGrad)"
          stroke="#38bdf8"
          strokeWidth="1.2"
        />

        {/* Visor Glare Accent */}
        <path
          d="M22 22 Q32 20 42 22"
          fill="none"
          stroke="#ffffff"
          strokeWidth="1"
          strokeOpacity="0.4"
          strokeLinecap="round"
        />

        {/* 7. Animated Glowing Eyes */}
        <g className="animate-copilot-eyes">
          {/* Left Eye */}
          <circle cx="26" cy="26" r="2.8" fill="#38bdf8" filter="url(#copilotGlow)" />
          <circle cx="27.2" cy="25" r="0.8" fill="#ffffff" />

          {/* Right Eye */}
          <circle cx="38" cy="26" r="2.8" fill="#38bdf8" filter="url(#copilotGlow)" />
          <circle cx="39.2" cy="25" r="0.8" fill="#ffffff" />
        </g>

        {/* 8. Waving Arm & Flight-Glove Hand */}
        <g className={cn(waving && "animate-copilot-wave")}>
          {/* Forearm angled up */}
          <path
            d="M44 47 Q48 40 50 34"
            fill="none"
            stroke="#0f172a"
            strokeWidth="4"
            strokeLinecap="round"
          />
          {/* Cyan suit band */}
          <path d="M48 37 L51 35" stroke="#38bdf8" strokeWidth="1.5" />

          {/* Pilot Hand / Flight Glove */}
          {/* Palm */}
          <circle cx="51.5" cy="30.5" r="4.2" fill="#f8fafc" stroke="#94a3b8" strokeWidth="0.8" />
          
          {/* Thumb */}
          <path
            d="M47.8 32 C46.5 30 47.5 28 49.5 29"
            fill="none"
            stroke="#f8fafc"
            strokeWidth="2.4"
            strokeLinecap="round"
          />

          {/* Waving Fingers */}
          {/* Index */}
          <path d="M50 27.5 L50.5 21" stroke="#f8fafc" strokeWidth="2.2" strokeLinecap="round" />
          {/* Middle */}
          <path d="M52.5 27.8 L53.8 20" stroke="#f8fafc" strokeWidth="2.2" strokeLinecap="round" />
          {/* Ring */}
          <path d="M55 28.5 L57 21.5" stroke="#f8fafc" strokeWidth="2.2" strokeLinecap="round" />
          {/* Pinky */}
          <path d="M56.8 30.2 L59.5 24.5" stroke="#f8fafc" strokeWidth="1.8" strokeLinecap="round" />

          {/* Glove Wrist Cuff */}
          <rect
            x="48"
            y="33"
            width="5"
            height="1.8"
            rx="0.9"
            fill="#0284c7"
            transform="rotate(-28 48 33)"
          />
        </g>
      </svg>

      {/* Online Telemetry Status Dot */}
      {showStatusDot && (
        <span className="absolute -top-0.5 -right-0.5 flex h-2.5 w-2.5">
          {isOnline && (
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
          )}
          <span
            className={cn(
              "relative inline-flex rounded-full h-2.5 w-2.5 border-2 border-slate-900",
              isOnline ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.9)]" : "bg-slate-500"
            )}
          />
        </span>
      )}
    </div>
  );
}
