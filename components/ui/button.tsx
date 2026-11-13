import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 select-none cursor-pointer",
  {
    variants: {
      variant: {
        default:
          "btn-glass-primary shadow-sm",
        primary:
          "btn-glass-primary shadow-md",
        destructive:
          "bg-red-500/15 text-red-400 border border-red-500/30 hover:bg-red-500/25 hover:border-red-500/50 shadow-xs",
        outline:
          "border border-[var(--border)] bg-[var(--glass-surface-2)] backdrop-blur-md hover:bg-[var(--glass-surface-3)] hover:border-[var(--border-strong)] text-[var(--foreground)] shadow-xs",
        secondary:
          "bg-[var(--glass-surface-3)] text-[var(--foreground)] hover:bg-[var(--glass-surface-2)] border border-[var(--border)] font-medium shadow-2xs",
        ghost:
          "hover:bg-[var(--glass-surface-3)] text-[var(--foreground)] hover:text-white",
        link:
          "text-sky-400 hover:text-sky-300 underline-offset-4 hover:underline p-0 h-auto font-normal",
        subtle:
          "bg-sky-500/15 text-sky-300 hover:bg-sky-500/25 border border-sky-500/30 shadow-2xs",
      },
      size: {
        default: "min-h-[42px] px-4 py-2 text-sm sm:min-h-[38px]",
        sm: "min-h-[36px] px-3 py-1.5 text-xs rounded-lg sm:min-h-[32px]",
        lg: "min-h-[46px] px-6 py-2.5 text-base rounded-xl font-bold",
        icon: "h-10 w-10 min-h-[40px] min-w-[40px] rounded-xl p-0 sm:h-9 sm:w-9 sm:min-h-[36px] sm:min-w-[36px]",
        iconSm: "h-8 w-8 min-h-[32px] min-w-[32px] rounded-lg p-0",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  ),
);
Button.displayName = "Button";
