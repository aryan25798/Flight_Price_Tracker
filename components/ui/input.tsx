import * as React from "react";
import { cn } from "@/lib/utils";

export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, type, ...props }, ref) => {
  return (
    <input
      type={type}
      className={cn(
        "flex min-h-[42px] w-full rounded-xl border border-[var(--border)] bg-[var(--glass-surface-2)] px-3.5 py-2 text-sm text-[var(--foreground)] backdrop-blur-md shadow-inner transition-all duration-200 placeholder:text-[var(--muted-foreground)]/60 hover:border-[var(--border-strong)] focus-visible:outline-none focus-visible:border-sky-500/60 focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:bg-[var(--glass-surface-3)] disabled:cursor-not-allowed disabled:opacity-50 sm:min-h-[40px]",
        className,
      )}
      ref={ref}
      {...props}
    />
  );
});
Input.displayName = "Input";
