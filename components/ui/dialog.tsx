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

  // Lock background scroll when open
  React.useEffect(() => {
    if (open) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 p-3 sm:p-4 md:p-6 backdrop-blur-md animate-in fade-in duration-200"
      onClick={() => onOpenChange(false)}
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? "dialog-title" : undefined}
    >
      <div
        className={cn(
          "relative w-full my-auto max-h-[88vh] max-h-[88dvh] flex flex-col rounded-2xl glass-floating p-4 sm:p-6 text-[var(--foreground)] border border-[var(--border)] shadow-[0_25px_60px_-15px_rgba(0,0,0,0.85)] overflow-hidden",
          maxWidthClass,
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {title ? (
          <div className="shrink-0 mb-3 sm:mb-4 flex items-start justify-between gap-3 border-b border-[var(--border)] pb-3">
            <div className="pr-2">
              <h2 id="dialog-title" className="text-base sm:text-lg font-bold tracking-tight text-[var(--foreground)]">
                {title}
              </h2>
              {description && (
                <p className="mt-1 text-xs sm:text-sm text-[var(--muted-foreground)] leading-relaxed">
                  {description}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="shrink-0 rounded-xl p-1.5 text-[var(--muted-foreground)] hover:bg-[var(--glass-surface-3)] hover:text-[var(--foreground)] cursor-pointer transition-colors"
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
        <div className="flex-1 overflow-y-auto pr-1 focus:outline-hidden space-y-4">
          {children}
        </div>
      </div>
    </div>
  );
}
