import Link from "next/link";
import {
  LineChart,
  Plane,
  Radio,
  ShieldCheck,
  Sparkles,
  TrendingDown,
} from "lucide-react";
import { ThemeToggle } from "@/components/shared/theme-toggle";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative h-screen max-h-screen w-full flex flex-col justify-between ambient-night-mesh selection:bg-sky-500/25 overflow-y-auto sm:overflow-hidden">
      {/* Top Header */}
      <header className="relative z-20 shrink-0 flex h-12 sm:h-14 items-center justify-between px-4 sm:px-8 max-w-7xl mx-auto w-full">
        <Link
          href="/"
          className="flex items-center gap-2.5 font-bold tracking-tight text-[var(--foreground)] hover:opacity-90 transition-opacity group"
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-sky-400 via-blue-600 to-indigo-600 text-white shadow-[0_0_12px_rgba(56,189,248,0.35)]">
            <Plane className="h-4 w-4 rotate-45 transform" />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-extrabold tracking-tight">AeroDrop</span>
            <span className="text-[8px] font-bold tracking-widest uppercase text-sky-400">
              Flight Radar
            </span>
          </div>
        </Link>
        <ThemeToggle />
      </header>

      {/* Main Dual-Column Hero & Glass Card Container */}
      <main className="relative z-10 flex-1 min-h-0 flex items-center justify-center px-4 py-1 sm:py-2 lg:py-3">
        <div className="mx-auto w-full max-w-5xl grid grid-cols-1 lg:grid-cols-12 gap-5 lg:gap-10 items-center">
          
          {/* Left Column: Visual Travel Showcase & Value Props (Hidden on mobile, visible on desktop) */}
          <div className="lg:col-span-6 space-y-3 lg:space-y-4 text-left hidden lg:block">
            <div className="inline-flex items-center gap-2 rounded-full border border-sky-500/30 bg-sky-500/10 px-3 py-0.5 text-[11px] font-semibold text-sky-300 shadow-2xs backdrop-blur-md">
              <Sparkles className="h-3 w-3 text-sky-400" />
              <span>Smart Travel · Real-Time Savings</span>
            </div>

            <h1 className="text-2xl lg:text-3xl xl:text-4xl font-extrabold tracking-tight text-[var(--foreground)] leading-[1.15]">
              Never Overpay for{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-sky-400 via-blue-400 to-cyan-300">
                Flights
              </span>{" "}
              Again.
            </h1>

            <p className="text-xs lg:text-sm text-[var(--muted-foreground)] leading-relaxed max-w-md">
              Track global airline fares with 4-hour automated price checks. Receive instant alerts on Telegram the moment ticket prices drop below your custom target.
            </p>

            {/* Travel Value Highlights - Compact Micro Cards */}
            <div className="space-y-2 pt-1">
              <div className="flex items-center gap-3 rounded-xl glass-surface-2 p-2.5 border border-[var(--border)] max-w-md">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-sky-500/15 text-sky-400">
                  <LineChart className="h-3.5 w-3.5" />
                </div>
                <div className="min-w-0">
                  <h4 className="text-xs font-bold text-[var(--foreground)] leading-tight">Real-Time Price Tracking</h4>
                  <p className="text-[10px] text-[var(--muted-foreground)] truncate">Scans airline fares &amp; plots 30-day historical trend graphs</p>
                </div>
              </div>

              <div className="flex items-center gap-3 rounded-xl glass-surface-2 p-2.5 border border-[var(--border)] max-w-md">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-400">
                  <Radio className="h-3.5 w-3.5" />
                </div>
                <div className="min-w-0">
                  <h4 className="text-xs font-bold text-[var(--foreground)] leading-tight">Smart Alerts via Telegram</h4>
                  <p className="text-[10px] text-[var(--muted-foreground)] truncate">Zero latency push messages with 1-click booking and comparison</p>
                </div>
              </div>

              <div className="flex items-center gap-3 rounded-xl glass-surface-2 p-2.5 border border-[var(--border)] max-w-md">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-amber-500/15 text-amber-400">
                  <TrendingDown className="h-3.5 w-3.5" />
                </div>
                <div className="min-w-0">
                  <h4 className="text-xs font-bold text-[var(--foreground)] leading-tight">Multi-Site Comparison Engine</h4>
                  <p className="text-[10px] text-[var(--muted-foreground)] truncate">Cross-checks Google Flights, Skyscanner, MakeMyTrip &amp; more</p>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Luxury Glass Card Form */}
          <div className="w-full lg:col-span-6 flex justify-center lg:justify-end">
            <div className="w-full max-w-[400px]">
              {children}
            </div>
          </div>

        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 shrink-0 py-2 sm:py-2.5 text-center text-[10px] sm:text-[11px] text-[var(--muted-foreground)] border-t border-[var(--border)]/40">
        <div className="flex items-center justify-center gap-1.5">
          <ShieldCheck className="h-3 w-3 text-emerald-400" />
          <span>Encrypted with Supabase SSR Auth &amp; PostgreSQL Row-Level Security</span>
        </div>
      </footer>
    </div>
  );
}
