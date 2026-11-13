import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold tracking-wide transition-all duration-200 border backdrop-blur-md shadow-2xs select-none",
  {
    variants: {
      variant: {
        default:
          "bg-sky-500/15 text-sky-300 border-sky-500/30 shadow-[0_0_12px_rgba(56,189,248,0.15)]",
        cyan:
          "bg-cyan-500/15 text-cyan-300 border-cyan-500/30 shadow-[0_0_12px_rgba(6,182,212,0.15)]",
        success:
          "bg-emerald-500/15 text-emerald-300 border-emerald-500/30 shadow-[0_0_12px_rgba(16,185,129,0.15)]",
        emerald:
          "bg-emerald-500/15 text-emerald-300 border-emerald-500/30 shadow-[0_0_12px_rgba(16,185,129,0.15)]",
        warning:
          "bg-amber-500/15 text-amber-300 border-amber-500/30 shadow-[0_0_12px_rgba(245,158,11,0.15)]",
        amber:
          "bg-amber-500/15 text-amber-300 border-amber-500/30 shadow-[0_0_12px_rgba(245,158,11,0.15)]",
        destructive:
          "bg-red-500/15 text-red-300 border-red-500/30 shadow-[0_0_12px_rgba(239,68,68,0.15)]",
        secondary:
          "bg-[var(--glass-surface-3)] text-[var(--muted-foreground)] border-[var(--border)]",
        outline:
          "border-[var(--border-strong)] text-[var(--foreground)] bg-transparent",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {
  dot?: boolean;
}

export function Badge({ className, variant, dot, children, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant, className }))} {...props}>
      {dot && (
        <span
          className={cn(
            "h-1.5 w-1.5 rounded-full shrink-0 animate-pulse",
            (variant === "success" || variant === "emerald") && "bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]",
            (variant === "warning" || variant === "amber") && "bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.8)]",
            variant === "destructive" && "bg-red-400 shadow-[0_0_6px_rgba(248,113,113,0.8)]",
            (variant === "default" || variant === "cyan") && "bg-sky-400 shadow-[0_0_6px_rgba(56,189,248,0.8)]",
            (!variant || variant === "secondary") && "bg-[var(--muted-foreground)]",
          )}
        />
      )}
      {children}
    </span>
  );
}
