import Link from "next/link";
import {
  BellRing,
  CheckCircle2,
  Globe2,
  LineChart,
  Percent,
  Plane,
  Radio,
  ShieldCheck,
  Sparkles,
  TrendingDown,
  Zap,
} from "lucide-react";
import { ThemeToggle } from "@/components/shared/theme-toggle";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen flex flex-col justify-between ambient-night-mesh selection:bg-sky-500/25 overflow-x-hidden">
      {/* Top Header */}
      <header className="relative z-20 flex h-16 items-center justify-between px-5 sm:px-8 max-w-7xl mx-auto w-full">
        <Link
          href="/"
          className="flex items-center gap-3 font-bold tracking-tight text-[var(--foreground)] hover:opacity-90 transition-opacity group"
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-400 via-blue-600 to-indigo-600 text-white shadow-[0_0_15px_rgba(56,189,248,0.35)]">
            <Plane className="h-4 w-4 rotate-45 transform" />
          </div>
          <div className="flex flex-col">
            <span className="text-base font-extrabold tracking-tight">AeroDrop</span>
            <span className="text-[9px] font-bold tracking-widest uppercase text-sky-400">
              Flight Radar
            </span>
          </div>
        </Link>
        <ThemeToggle />
      </header>

      {/* Main Dual-Column Hero & Glass Card Container */}
      <main className="relative z-10 flex flex-1 items-center justify-center px-4 py-8 sm:py-12 lg:py-16">
        <div className="mx-auto w-full max-w-5xl grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
          
          {/* Left Column: Visual Travel Showcase & Value Props (Hidden on very small mobile, visible on tablet/desktop) */}
          <div className="lg:col-span-6 space-y-6 text-left hidden sm:block">
            <div className="inline-flex items-center gap-2 rounded-full border border-sky-500/30 bg-sky-500/10 px-3.5 py-1 text-xs font-semibold text-sky-300 shadow-2xs backdrop-blur-md">
              <Sparkles className="h-3.5 w-3.5 text-sky-400" />
              <span>Smart Travel · Real-Time Savings</span>
            </div>

            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-[var(--foreground)] leading-[1.15]">
              Never Overpay for{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-sky-400 via-blue-400 to-cyan-300">
                Flights
              </span>{" "}
              Again.
            </h1>

            <p className="text-sm sm:text-base text-[var(--muted-foreground)] leading-relaxed max-w-lg">
              Track global airline fares with 4-hour automated price checks. Receive instant alerts on Telegram the moment ticket prices drop below your custom target.
            </p>

            {/* Travel Value Highlights */}
            <div className="space-y-3.5 pt-2">
              <div className="flex items-center gap-3 rounded-xl glass-surface-2 p-3 border border-[var(--border)] max-w-md">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sky-500/15 text-sky-400">
                  <LineChart className="h-4 w-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-[var(--foreground)]">Real-Time Price Tracking</h4>
                  <p className="text-[11px] text-[var(--muted-foreground)]">Scans airline fares &amp; plots 30-day historical trend graphs</p>
                </div>
              </div>

              <div className="flex items-center gap-3 rounded-xl glass-surface-2 p-3 border border-[var(--border)] max-w-md">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-400">
                  <Radio className="h-4 w-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-[var(--foreground)]">Smart Alerts via Telegram</h4>
                  <p className="text-[11px] text-[var(--muted-foreground)]">Zero latency push messages with 1-click booking and comparison</p>
                </div>
              </div>

              <div className="flex items-center gap-3 rounded-xl glass-surface-2 p-3 border border-[var(--border)] max-w-md">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-500/15 text-amber-400">
                  <TrendingDown className="h-4 w-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-[var(--foreground)]">Multi-Site Comparison Engine</h4>
                  <p className="text-[11px] text-[var(--muted-foreground)]">Cross-checks Google Flights, Skyscanner, MakeMyTrip &amp; more</p>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Luxury Glass Card Form */}
          <div className="w-full lg:col-span-6 flex justify-center lg:justify-end">
            <div className="w-full max-w-[430px]">
              {children}
            </div>
          </div>

        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 py-5 text-center text-xs text-[var(--muted-foreground)] border-t border-[var(--border)]/50">
        <div className="flex items-center justify-center gap-2">
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
          <span>Encrypted with Supabase SSR Auth &amp; PostgreSQL Row-Level Security</span>
        </div>
      </footer>
    </div>
  );
}
