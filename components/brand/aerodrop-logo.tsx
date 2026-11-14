import React from "react";
import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface AeroDropLogoProps {
  /**
   * "mark": Just the icon badge (for collapsed sidebar, mobile navbar, favicon)
   * "full": Icon badge + "AeroDrop" logotype + "FLIGHT RADAR" subtitle
   * "wordmark": Just the stylized "AeroDrop" text
   */
  variant?: "mark" | "full" | "wordmark";
  /**
   * Size presets or custom px
   */
  size?: "sm" | "md" | "lg" | "xl";
  /**
   * Dark theme (for midnight/dark surfaces) vs Light theme
   */
  theme?: "dark" | "light" | "auto";
  /**
   * Optional link destination (defaults to none or /)
   */
  href?: string;
  className?: string;
  subtitle?: string;
}

const sizeConfig = {
  sm: { icon: 32, text: "text-lg", sub: "text-[9px]" },
  md: { icon: 40, text: "text-xl", sub: "text-[10px]" },
  lg: { icon: 48, text: "text-2xl", sub: "text-[11px]" },
  xl: { icon: 56, text: "text-3xl", sub: "text-xs" },
};

export function AeroDropLogo({
  variant = "full",
  size = "md",
  theme = "dark",
  href,
  className,
  subtitle = "FLIGHT RADAR",
}: AeroDropLogoProps) {
  const cfg = sizeConfig[size];

  const content = (
    <div
      className={cn(
        "inline-flex items-center gap-3 select-none group transition-opacity duration-200",
        href && "hover:opacity-95 cursor-pointer",
        className,
      )}
    >
      {/* Precision Vector Icon Badge */}
      {variant !== "wordmark" && (
        <div
          style={{ width: cfg.icon, height: cfg.icon }}
          className={cn(
            "relative shrink-0 rounded-2xl overflow-hidden transition-transform duration-200 group-hover:scale-[1.03]",
            "border border-white/10 shadow-[0_4px_16px_rgba(2,132,199,0.25)]",
          )}
        >
          <Image
            src="/brand/aerodrop-mark.svg"
            alt="AeroDrop"
            width={cfg.icon}
            height={cfg.icon}
            priority
            className="w-full h-full object-contain"
          />
        </div>
      )}

      {/* Brand Typography */}
      {variant !== "mark" && (
        <div className="flex flex-col leading-none">
          <span
            className={cn(
              "font-bold tracking-tight",
              cfg.text,
              theme === "light" ? "text-slate-900" : "text-white",
            )}
          >
            Aero
            <span className={theme === "light" ? "text-sky-600" : "text-sky-400"}>
              Drop
            </span>
          </span>
          {subtitle && (
            <span
              className={cn(
                "font-semibold tracking-[0.2em] uppercase mt-1",
                cfg.sub,
                theme === "light" ? "text-slate-500" : "text-slate-400",
              )}
            >
              {subtitle}
            </span>
          )}
        </div>
      )}
    </div>
  );

  if (href) {
    return (
      <Link href={href} aria-label="AeroDrop Home" className="inline-block">
        {content}
      </Link>
    );
  }

  return content;
}
