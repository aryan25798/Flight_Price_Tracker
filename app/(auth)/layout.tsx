import Image from "next/image";
import Link from "next/link";
import {
  Bell,
  CheckCircle2,
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
    <div className="relative min-h-screen w-full flex flex-col justify-between ambient-night-mesh selection:bg-sky-500/25 overflow-x-hidden">
      {/* Background aviation texture for subtle atmospheric depth */}
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden opacity-15 dark:opacity-10">
        <Image
          src="/images/airplane-wing-twilight.webp"
          alt="Aviation wing background"
          fill
          priority
          sizes="100vw"
          className="object-cover object-top"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#080C17]/80 to-[#080C17]" />
      </div>

      {/* Top Header */}
      <header className="relative z-20 shrink-0 flex h-14 sm:h-16 items-center justify-between px-4 sm:px-8 max-w-7xl mx-auto w-full">
        <Link
          href="/"
          className="flex items-center gap-2.5 font-bold tracking-tight text-[var(--foreground)] hover:opacity-90 transition-opacity group"
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-sky-400 via-blue-600 to-indigo-600 text-white shadow-[0_0_15px_rgba(56,189,248,0.35)]">
            <Plane className="h-4 w-4 rotate-45 transform" />
          </div>
          <div className="flex flex-col">
            <span className="text-sm sm:text-base font-extrabold tracking-tight">AeroDrop</span>
            <span className="text-[8px] sm:text-[9px] font-bold tracking-widest uppercase text-sky-400">
              Flight Radar
            </span>
          </div>
        </Link>
        <ThemeToggle />
      </header>

      {/* Main Dual-Column Hero & Glass Card Container */}
      <main className="relative z-10 flex-1 flex items-center justify-center px-4 py-4 sm:py-6 lg:py-8">
        <div className="mx-auto w-full max-w-5xl grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-10 items-center">
          
          {/* Left Column: Visual Travel Showcase & Value Props with Aviation Photography (Desktop) */}
          <div className="lg:col-span-6 hidden lg:block">
            <div className="relative overflow-hidden rounded-3xl glass-surface-1 border border-[var(--border)] p-6 xl:p-8 shadow-2xl space-y-6">
              {/* Background Aviation Wing Photograph */}
              <div className="absolute inset-0 z-0">
                <Image
                  src="/images/airplane-wing-twilight.webp"
                  alt="Airplane wing cruising over sunset clouds"
                  fill
                  priority
                  sizes="(max-width: 1200px) 50vw, 600px"
                  className="object-cover object-center opacity-30 dark:opacity-25"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#0B1120] via-[#0B1120]/75 to-transparent" />
                <div className="absolute inset-0 bg-gradient-to-r from-[#0B1120]/90 to-transparent" />
              </div>

              {/* Foreground Storytelling */}
              <div className="relative z-10 space-y-4">
                <div className="inline-flex items-center gap-2 rounded-full border border-sky-500/30 bg-sky-500/10 px-3.5 py-1 text-xs font-semibold text-sky-300 shadow-2xs backdrop-blur-md">
                  <Sparkles className="h-3.5 w-3.5 text-sky-400 animate-pulse" />
                  <span>Smart Travel · Autonomous Price Radar</span>
                </div>

                <h1 className="text-2xl xl:text-3xl font-extrabold tracking-tight text-[var(--foreground)] leading-[1.18]">
                  Never Overpay for{" "}
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-sky-400 via-blue-400 to-cyan-300">
                    Airline Tickets
                  </span>{" "}
                  Again.
                </h1>

                <p className="text-xs xl:text-sm text-[var(--muted-foreground)] leading-relaxed">
                  AeroDrop scans global airfares every 4 hours across 100+ airlines. Receive instant alerts on Telegram and email the moment fares drop below your custom threshold.
                </p>

                {/* Feature Micro-Badges */}
                <div className="space-y-2.5 pt-2">
                  <div className="flex items-center gap-3 rounded-xl glass-surface-2 p-2.5 border border-[var(--border)] backdrop-blur-md">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sky-500/15 text-sky-400 border border-sky-500/25">
                      <LineChart className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-xs font-bold text-[var(--foreground)]">Automated 4-Hour Fare Radar</h4>
                      <p className="text-[11px] text-[var(--muted-foreground)] truncate">24/7 background tracking with 30-day price trends</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 rounded-xl glass-surface-2 p-2.5 border border-[var(--border)] backdrop-blur-md">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-400 border border-emerald-500/25">
                      <Radio className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-xs font-bold text-[var(--foreground)]">Direct Telegram &amp; In-App Alerts</h4>
                      <p className="text-[11px] text-[var(--muted-foreground)] truncate">Zero-latency price drop alerts with 1-click booking</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 rounded-xl glass-surface-2 p-2.5 border border-[var(--border)] backdrop-blur-md">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-500/15 text-amber-400 border border-amber-500/25">
                      <TrendingDown className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-xs font-bold text-[var(--foreground)]">6-Site Comparison Engine</h4>
                      <p className="text-[11px] text-[var(--muted-foreground)] truncate">Google Flights, Skyscanner, MakeMyTrip &amp; EaseMyTrip</p>
                    </div>
                  </div>
                </div>

                {/* Live Member Trust Badge */}
                <div className="flex items-center gap-2 pt-2 text-[11px] text-[var(--muted-foreground)]">
                  <div className="flex -space-x-1.5">
                    <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-sky-600 text-[9px] font-bold text-white ring-2 ring-[var(--card)]">DEL</span>
                    <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-indigo-600 text-[9px] font-bold text-white ring-2 ring-[var(--card)]">BOM</span>
                    <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-600 text-[9px] font-bold text-white ring-2 ring-[var(--card)]">BLR</span>
                  </div>
                  <span>Monitoring over <strong>8,700+</strong> active route combinations daily</span>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Luxury Glass Card Form */}
          <div className="w-full lg:col-span-6 flex justify-center lg:justify-end">
            <div className="w-full max-w-[420px]">
              {children}
            </div>
          </div>

        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-20 shrink-0 py-3 text-center text-xs text-[var(--muted-foreground)]">
        <span>© 2026 AeroDrop · Autonomous Travel Intelligence</span>
      </footer>
    </div>
  );
}
