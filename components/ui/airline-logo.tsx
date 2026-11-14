"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface AirlineLogoProps extends React.HTMLAttributes<HTMLDivElement> {
  code: string;
  name?: string;
  logoUrl?: string | null;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
}

const SIZE_MAP = {
  xs: "h-6 w-6 rounded-md p-0.5",
  sm: "h-8 w-8 rounded-lg p-1",
  md: "h-11 w-11 rounded-xl p-1.5",
  lg: "h-12 w-12 rounded-2xl p-2",
  xl: "h-14 w-14 rounded-2xl p-2.5",
};

const TEXT_SIZE_MAP = {
  xs: "text-[9px]",
  sm: "text-[10px]",
  md: "text-xs",
  lg: "text-sm",
  xl: "text-base",
};

/**
 * Returns primary Google Flights high-res CDN logo URL for an airline.
 */
export function getAirlineLogoUrl(code?: string, explicitUrl?: string | null): string {
  if (explicitUrl && explicitUrl.trim().startsWith("http")) {
    return explicitUrl.trim();
  }
  const cleanCode = (code || "FL").trim().toUpperCase();
  return `https://www.gstatic.com/flights/airline_logos/70px/${cleanCode}.png`;
}

/**
 * Secondary Aviasales / Travelpayouts CDN logo URL fallback.
 */
function getSecondaryLogoUrl(code: string): string {
  const cleanCode = (code || "FL").trim().toUpperCase();
  return `https://pics.avs.io/al_square/64/64/${cleanCode}.png`;
}

// Airline branding color accent generator for text fallback
function getAirlineFallbackStyle(code: string): { bg: string; text: string; border: string } {
  const upper = (code || "").toUpperCase();
  if (upper === "6E") return { bg: "bg-blue-600/15", text: "text-blue-300", border: "border-blue-500/30" };
  if (upper === "AI") return { bg: "bg-red-600/15", text: "text-red-300", border: "border-red-500/30" };
  if (upper === "IX") return { bg: "bg-amber-600/15", text: "text-amber-300", border: "border-amber-500/30" };
  if (upper === "QP") return { bg: "bg-orange-600/15", text: "text-orange-300", border: "border-orange-500/30" };
  if (upper === "SG") return { bg: "bg-red-700/15", text: "text-red-400", border: "border-red-600/30" };
  if (upper === "UK") return { bg: "bg-purple-600/15", text: "text-purple-300", border: "border-purple-500/30" };
  if (upper === "EK") return { bg: "bg-red-800/15", text: "text-red-300", border: "border-red-700/30" };
  if (upper === "QR") return { bg: "bg-rose-900/15", text: "text-rose-300", border: "border-rose-700/30" };
  return { bg: "bg-slate-800/60", text: "text-slate-300", border: "border-slate-700/50" };
}

/**
 * Production-grade Airline Logo with multi-CDN fallbacks and crisp white pill presentation
 * matching Skyscanner, MakeMyTrip, and Google Flights.
 */
export function AirlineLogo({
  code,
  name,
  logoUrl,
  size = "md",
  className,
  ...props
}: AirlineLogoProps) {
  const cleanCode = (code || "FL").trim().toUpperCase();
  const [attempt, setAttempt] = React.useState<number>(0);
  const [loaded, setLoaded] = React.useState<boolean>(false);

  // Compute current image URL based on fallback attempt
  const currentSrc = React.useMemo(() => {
    if (attempt === 0) {
      return getAirlineLogoUrl(cleanCode, logoUrl);
    }
    if (attempt === 1) {
      return getSecondaryLogoUrl(cleanCode);
    }
    return null; // Exhausted image CDNs, show styled badge
  }, [attempt, cleanCode, logoUrl]);

  const fallbackStyle = getAirlineFallbackStyle(cleanCode);

  return (
    <div
      className={cn(
        "relative flex shrink-0 items-center justify-center overflow-hidden transition-all duration-200",
        // Crisp white card container (MakeMyTrip / Skyscanner style) to make dark & colorful airline logos pop
        currentSrc && attempt < 2
          ? "bg-white shadow-xs border border-slate-200/80 dark:border-white/10"
          : cn("border font-mono font-bold shadow-xs", fallbackStyle.bg, fallbackStyle.text, fallbackStyle.border),
        SIZE_MAP[size],
        className
      )}
      title={name ? `${name} (${cleanCode})` : cleanCode}
      {...props}
    >
      {currentSrc && attempt < 2 ? (
        <>
          {/* Subtle loading placeholder shimmer */}
          {!loaded && (
            <span
              className={cn(
                "absolute inset-0 flex items-center justify-center font-bold font-mono text-slate-400 bg-slate-100",
                TEXT_SIZE_MAP[size]
              )}
            >
              {cleanCode.slice(0, 2)}
            </span>
          )}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={currentSrc}
            alt={name || `${cleanCode} logo`}
            loading="lazy"
            decoding="async"
            onLoad={() => setLoaded(true)}
            onError={() => {
              setLoaded(false);
              setAttempt((prev) => prev + 1);
            }}
            className={cn(
              "h-full w-full object-contain transition-opacity duration-200",
              loaded ? "opacity-100" : "opacity-0"
            )}
          />
        </>
      ) : (
        <span className={cn("font-extrabold tracking-tight", TEXT_SIZE_MAP[size])}>
          {cleanCode.slice(0, 3)}
        </span>
      )}
    </div>
  );
}
