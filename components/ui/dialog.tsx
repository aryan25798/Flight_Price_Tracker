"use client";

import * as React from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description?: string;
  children: React.ReactNode;
  maxWidthClass?: string;
}

export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  maxWidthClass = "max-w-lg",
}: DialogProps) {
  React.useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onOpenChange(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onOpenChange]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-md animate-in fade-in duration-200"
      onClick={() => onOpenChange(false)}
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? "dialog-title" : undefined}
    >
      <div
        className={cn(
          "relative w-full rounded-2xl glass-floating p-5 sm:p-6 text-[var(--foreground)]",
          maxWidthClass,
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {title ? (
          <div className="mb-4 flex items-start justify-between gap-4 border-b border-[var(--border)] pb-3">
            <div>
              <h2 id="dialog-title" className="text-base sm:text-lg font-bold tracking-tight text-[var(--foreground)]">
                {title}
              </h2>
              {description && (
                <p className="mt-1 text-xs sm:text-sm text-[var(--muted-foreground)]">
                  {description}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="rounded-xl p-1.5 text-[var(--muted-foreground)] hover:bg-[var(--glass-surface-3)] hover:text-[var(--foreground)] cursor-pointer transition-colors"
              aria-label="Close dialog"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="absolute top-4 right-4 rounded-xl p-1.5 text-[var(--muted-foreground)] hover:bg-[var(--glass-surface-3)] hover:text-[var(--foreground)] cursor-pointer transition-colors z-10"
            aria-label="Close dialog"
          >
            <X className="h-4 w-4" />
          </button>
        )}
        {children}
      </div>
    </div>
  );
}
