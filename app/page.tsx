import Link from "next/link";
import Image from "next/image";
import {
  ArrowRight,
  ArrowRightLeft,
  Bell,
  CheckCircle2,
  Clock,
  Compass,
  LineChart,
  Plane,
  Radio,
  ShieldCheck,
  Sparkles,
  TrendingDown,
  Zap,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "@/components/shared/theme-toggle";

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="min-h-screen flex flex-col ambient-night-mesh selection:bg-sky-500/25 overflow-x-hidden">
      {/* Top Navbar */}
      <header className="sticky top-0 z-40 border-b border-[var(--border)] glass-panel backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-3 font-bold tracking-tight text-[var(--foreground)] group">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-400 via-blue-600 to-indigo-600 text-white shadow-[0_0_20px_rgba(56,189,248,0.35)] group-hover:shadow-[0_0_25px_rgba(56,189,248,0.5)] transition-all">
              <Plane className="h-5 w-5 rotate-45" />
            </div>
            <div className="flex flex-col">
              <span className="text-base font-extrabold tracking-tight">AeroDrop</span>
              <span className="text-[10px] font-bold tracking-widest uppercase text-sky-400">
                Flight Radar
              </span>
            </div>
          </Link>

          <div className="flex items-center gap-3">
            <ThemeToggle />
            {user ? (
              <Link href="/dashboard">
                <Button className="gap-2 font-bold shadow-md">
                  <span>Open Radar</span>
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            ) : (
              <div className="flex items-center gap-2">
                <Link href="/login">
                  <Button variant="ghost" size="sm" className="font-semibold text-xs sm:text-sm">
                    Sign In
                  </Button>
                </Link>
                <Link href="/signup">
                  <Button size="sm" className="font-bold shadow-md text-xs sm:text-sm">
                    Get Started Free
                  </Button>
                </Link>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero Section with Aviation Photography & Atmospheric Glow */}
        <section className="relative overflow-hidden pt-12 pb-20 sm:pt-20 sm:pb-28 lg:pt-28 lg:pb-36 text-center">
          {/* Authentic Aviation Photography Background Layer */}
          <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden select-none">
            <Image
              src="/images/airplane-hero-sky.webp"
              alt="Commercial jetliner cruising smoothly above sunset cloudscapes"
              fill
              priority
              sizes="100vw"
              quality={85}
              className="object-cover object-[center_28%] opacity-30 dark:opacity-25"
            />
            {/* Atmospheric gradient overlay protecting text readability */}
            <div className="absolute inset-0 bg-gradient-to-b from-[#080c17]/60 via-[#080c17]/85 to-[#080c17]" />
            {/* Radial atmospheric soft lights */}
            <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[680px] h-[360px] bg-sky-500/12 rounded-full blur-[140px]" />
            <div className="absolute top-1/3 left-1/4 w-[420px] h-[280px] bg-blue-600/10 rounded-full blur-[120px]" />
          </div>

          <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="max-w-3xl mx-auto space-y-6">
              {/* Refined Glass Badge */}
              <div className="inline-flex items-center gap-2.5 rounded-full border border-sky-500/30 bg-sky-500/10 px-4 py-1.5 text-xs font-semibold text-sky-300 shadow-[0_0_20px_rgba(56,189,248,0.18)] backdrop-blur-md">
                <Radio className="h-3.5 w-3.5 text-sky-400 animate-pulse" />
                <span>Autonomous 4-Hour Price Radar &amp; Instant Telegram Alerts</span>
              </div>

              {/* Headline Typography */}
              <h1 className="text-3xl font-extrabold tracking-tight sm:text-5xl lg:text-6xl text-[var(--foreground)] leading-[1.12]">
                Never overpay for{" "}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-sky-400 via-blue-400 to-cyan-300">
                  airline tickets
                </span>{" "}
                again.
              </h1>

              <p className="mx-auto max-w-2xl text-sm sm:text-base lg:text-lg text-[var(--muted-foreground)] leading-relaxed">
                Configure your alert threshold for any global route. AeroDrop scans live airline fares around the clock, plots 30-day historical trends, and pings you on Telegram the moment fares drop.
              </p>

              <div className="flex flex-wrap items-center justify-center gap-3.5 pt-2">
                <Link href={user ? "/dashboard" : "/signup"}>
                  <Button size="lg" className="min-h-[48px] px-8 gap-2 text-base font-bold shadow-lg">
                    <span>{user ? "Go to Flight Console" : "Start Tracking Routes Free"}</span>
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
                <Link href="/login">
                  <Button size="lg" variant="outline" className="min-h-[48px] px-6 text-base font-semibold">
                    Existing User Sign In
                  </Button>
                </Link>
              </div>
            </div>

            {/* Interactive Live Route Preview Simulator */}
            <div className="relative z-10 mx-auto mt-12 sm:mt-16 max-w-4xl">
            <div className="glass-surface-1 rounded-2xl border border-[var(--border)] p-4 sm:p-7 shadow-2xl text-left">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] pb-4">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-3 w-3 rounded-full bg-emerald-400 animate-ping" />
                  <span className="text-xs font-bold uppercase tracking-wider text-[var(--foreground)]">
                    Live Flight Price Drop Simulation
                  </span>
                </div>
                <Badge variant="success" dot className="text-xs font-semibold">
                  Telegram Alert Triggered (-24%)
                </Badge>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 items-center">
                {/* Route Segment */}
                <div className="space-y-1">
                  <div className="flex items-center gap-2 font-mono text-2xl font-black text-[var(--foreground)]">
                    <span>DEL</span>
                    <ArrowRight className="h-5 w-5 text-sky-400" />
                    <span>BOM</span>
                  </div>
                  <p className="text-xs text-[var(--muted-foreground)]">
                    New Delhi to Mumbai · IndiGo 6E-205
                  </p>
                  <p className="text-[11px] font-medium text-[var(--muted-foreground)]">
                    Departing 15 Dec 2026 · Non-Stop (2h 15m)
                  </p>
                </div>

                {/* Price Movement */}
                <div className="rounded-xl glass-surface-2 border border-[var(--border)] p-3.5 space-y-1">
                  <div className="flex items-center justify-between text-xs text-[var(--muted-foreground)]">
                    <span>Previous Fare</span>
                    <span className="line-through font-mono">₹4,890</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[var(--foreground)]">Observed Now</span>
                    <span className="font-mono text-xl font-black text-emerald-400">
                      ₹3,720
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] font-semibold text-emerald-400">
                    <span>You Save: ₹1,170</span>
                    <span className="text-[var(--muted-foreground)]">Target: ₹4,000</span>
                  </div>
                </div>

                {/* Push Notification Card */}
                <div className="rounded-xl border border-sky-500/30 bg-sky-500/10 p-3.5 space-y-1.5 backdrop-blur-md">
                  <div className="flex items-center gap-2 text-xs font-bold text-sky-300">
                    <Radio className="h-3.5 w-3.5 text-sky-400" />
                    <span>Telegram Alert Dispatched</span>
                  </div>
                  <p className="text-[11px] text-[var(--foreground)] line-clamp-2">
                    ✈️ Fare dropped to ₹3,720 (₹280 below your target)! Tap below to book directly.
                  </p>
                  <div className="inline-flex items-center gap-1 text-[11px] font-bold text-sky-400">
                    <span>Delivered in 240ms</span>
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Architectural Feature Cards */}
          <div className="mt-16 sm:mt-24 grid gap-5 sm:grid-cols-3 text-left">
            <div className="glass-card-interactive rounded-2xl p-6 sm:p-7 space-y-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-sky-500/15 text-sky-400 border border-sky-500/30 shadow-[0_0_15px_rgba(56,189,248,0.25)]">
                <Clock className="h-5 w-5" />
              </div>
              <h3 className="text-base font-bold text-[var(--foreground)]">
                Deduplicated 4-Hour Polling
              </h3>
              <p className="text-xs sm:text-sm text-[var(--muted-foreground)] leading-relaxed">
                Deterministic SHA-256 route deduplication ensures 1,000 users monitoring the same route execute exactly 1 external API check, keeping your quotas safe.
              </p>
            </div>

            <div className="glass-card-interactive rounded-2xl p-6 sm:p-7 space-y-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 shadow-[0_0_15px_rgba(16,185,129,0.25)]">
                <LineChart className="h-5 w-5" />
              </div>
              <h3 className="text-base font-bold text-[var(--foreground)]">
                Historical Trend Charts
              </h3>
              <p className="text-xs sm:text-sm text-[var(--muted-foreground)] leading-relaxed">
                Inspect lowest, highest, and current airline fares against your target threshold with clean, interactive gradient area charts.
              </p>
            </div>

            <div className="glass-card-interactive rounded-2xl p-6 sm:p-7 space-y-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-500/15 text-amber-400 border border-amber-500/30 shadow-[0_0_15px_rgba(245,158,11,0.25)]">
                <Radio className="h-5 w-5" />
              </div>
              <h3 className="text-base font-bold text-[var(--foreground)]">
                Instant Telegram Push
              </h3>
              <p className="text-xs sm:text-sm text-[var(--muted-foreground)] leading-relaxed">
                Direct mobile push alerts bypass spam filters. Smart 12-hour cooldowns prevent notification fatigue, with instant bypass on 5% price drops.
              </p>
            </div>
          </div>
        </div>
      </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-[var(--border)] glass-panel py-8 px-4 sm:px-6 lg:px-8 text-center text-xs text-[var(--muted-foreground)]">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Plane className="h-4 w-4 text-sky-400" />
            <span className="font-bold text-[var(--foreground)]">AeroDrop Flight Tracker</span>
            <span>· Enterprise Edition</span>
          </div>
          <div className="flex items-center gap-4 text-xs font-mono">
            <span>Supabase SSR</span>
            <span>·</span>
            <span>Travelpayouts Data API v3</span>
            <span>·</span>
            <span>Deno Edge Functions</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
