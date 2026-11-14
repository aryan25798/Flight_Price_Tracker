import Link from "next/link";
import Image from "next/image";
import {
  ArrowRight,
  ArrowRightLeft,
  Bell,
  CheckCircle2,
  Clock,
  Compass,
  ExternalLink,
  Globe,
  LineChart,
  Radio,
  Search,
  ShieldCheck,
  Sparkles,
  TrendingDown,
  Zap,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AeroDropLogo } from "@/components/brand/aerodrop-logo";
import { ThemeToggle } from "@/components/shared/theme-toggle";

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="min-h-screen flex flex-col ambient-night-mesh selection:bg-sky-500/25 overflow-x-hidden">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-40 border-b border-[var(--border)] bg-[#060913]/90 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <AeroDropLogo variant="full" size="md" href="/" />

          <nav className="hidden md:flex items-center gap-7 text-xs font-semibold text-[var(--muted-foreground)]">
            <a href="#how-it-works" className="hover:text-[var(--foreground)] transition-colors">
              How It Works
            </a>
            <a href="#metasearch" className="hover:text-[var(--foreground)] transition-colors">
              Metasearch Coverage
            </a>
            <a href="#features" className="hover:text-[var(--foreground)] transition-colors">
              Radar Intelligence
            </a>
            <a href="#transparency" className="hover:text-[var(--foreground)] transition-colors">
              Zero-Cost Guarantee
            </a>
          </nav>

          <div className="flex items-center gap-3">
            <ThemeToggle />
            {user ? (
              <Link href="/dashboard">
                <Button className="gap-2 font-bold shadow-md bg-blue-600 hover:bg-blue-500 text-white min-h-[40px] px-4 rounded-xl">
                  <span>Open Radar</span>
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            ) : (
              <div className="flex items-center gap-2">
                <Link href="/login">
                  <Button variant="ghost" size="sm" className="font-semibold text-xs sm:text-sm text-[var(--foreground)] hover:bg-white/5">
                    Sign In
                  </Button>
                </Link>
                <Link href="/signup">
                  <Button size="sm" className="font-bold shadow-md text-xs sm:text-sm bg-blue-600 hover:bg-blue-500 text-white rounded-xl px-4 min-h-[38px]">
                    Get Started Free
                  </Button>
                </Link>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* =========================================================================
            HERO SECTION — PHOTOGRAPHY-LED WITH ATMOSPHERIC SKY LIGHTING
            ========================================================================= */}
        <section className="relative overflow-hidden pt-14 pb-20 sm:pt-24 sm:pb-32 lg:pt-28 lg:pb-36 text-center">
          {/* Authentic High-Altitude Aviation Photography Layer */}
          <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden select-none">
            <Image
              src="/images/airplane-clouds-soaring.webp"
              alt="Commercial airliner cruising gracefully through blue sky and majestic clouds"
              fill
              priority
              sizes="100vw"
              quality={95}
              className="object-cover object-[center_30%] opacity-85 dark:opacity-80"
            />
            {/* Controlled atmospheric gradient overlay protecting contrast & legibility */}
            <div className="absolute inset-0 bg-gradient-to-b from-[#060913]/35 via-[#060913]/65 to-[#060913]" />
            {/* Subtle atmospheric sky ambient tint */}
            <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[350px] bg-sky-500/15 rounded-full blur-[140px] pointer-events-none" />
          </div>

          <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="max-w-3xl mx-auto space-y-6">
              {/* Refined Glass Badge */}
              <div className="inline-flex items-center gap-2.5 rounded-full border border-sky-400/25 bg-slate-900/80 px-4 py-1.5 text-xs font-semibold text-sky-300 shadow-sm backdrop-blur-md">
                <Radio className="h-3.5 w-3.5 text-sky-400 animate-pulse" />
                <span>Autonomous 4-Hour Flight Radar · Triple-Channel Alerts</span>
              </div>

              {/* Headline Typography */}
              <h1 className="text-3xl font-extrabold tracking-tight sm:text-5xl lg:text-6xl text-[var(--foreground)] leading-[1.12]">
                Precision Flight Price Tracking for{" "}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-sky-400 via-blue-400 to-indigo-300">
                  Modern Travelers.
                </span>
              </h1>

              <p className="mx-auto max-w-2xl text-sm sm:text-base lg:text-lg text-slate-300 leading-relaxed">
                Configure your alert threshold for any global route. AeroDrop monitors airline fares around the clock, tracks 30-day price volatility, and pings you on Telegram, Email &amp; Browser Push the instant fares drop.
              </p>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center justify-center gap-3.5 pt-2">
                <Link href={user ? "/dashboard" : "/signup"}>
                  <Button size="lg" className="min-h-[48px] px-8 gap-2 text-base font-bold shadow-lg bg-blue-600 hover:bg-blue-500 text-white rounded-xl">
                    <span>{user ? "Open Flight Radar" : "Start Tracking Routes Free"}</span>
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
                <Link href="/login">
                  <Button size="lg" variant="outline" className="min-h-[48px] px-6 text-base font-semibold border-white/15 bg-slate-900/50 hover:bg-white/10 text-white rounded-xl">
                    Existing User Sign In
                  </Button>
                </Link>
              </div>
            </div>

            {/* Interactive Live Route Radar Preview Simulator */}
            <div className="relative z-10 mx-auto mt-12 sm:mt-16 max-w-4xl">
              <div className="glass-surface-1 rounded-3xl border border-[var(--border)] p-5 sm:p-7 shadow-2xl text-left bg-slate-900/90 backdrop-blur-xl">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] pb-4">
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-3 w-3 rounded-full bg-emerald-400 animate-ping" />
                    <span className="text-xs font-bold uppercase tracking-wider text-[var(--foreground)]">
                      Live Flight Price Drop Simulation
                    </span>
                  </div>
                  <Badge variant="success" dot className="text-xs font-semibold py-1 px-3">
                    Instant Flash Drop (-24%)
                  </Badge>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-5 items-center">
                  {/* Route Segment */}
                  <div className="space-y-1">
                    <div className="flex items-center gap-3 font-mono text-2xl font-black text-[var(--foreground)]">
                      <span>DEL</span>
                      <ArrowRight className="h-5 w-5 text-sky-400" />
                      <span>BOM</span>
                    </div>
                    <p className="text-xs text-[var(--muted-foreground)]">
                      New Delhi to Mumbai · IndiGo 6E-205
                    </p>
                    <p className="text-[11px] font-medium text-slate-400">
                      Departing 15 Dec 2026 · Non-Stop (2h 15m)
                    </p>
                  </div>

                  {/* Price Movement */}
                  <div className="rounded-2xl bg-slate-950/60 border border-[var(--border)] p-4 space-y-1.5">
                    <div className="flex items-center justify-between text-xs text-[var(--muted-foreground)]">
                      <span>Average 14-Day Fare</span>
                      <span className="line-through font-mono">₹4,890</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-[var(--foreground)]">Current Lowest</span>
                      <span className="font-mono text-xl font-black text-emerald-400">
                        ₹3,720
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[11px] font-semibold text-emerald-400 pt-0.5">
                      <span>Below Target by ₹280</span>
                      <span className="text-[var(--muted-foreground)]">Target: ₹4,000</span>
                    </div>
                  </div>

                  {/* Multi-Channel Push Notification Card */}
                  <div className="rounded-2xl border border-sky-400/25 bg-sky-500/10 p-4 space-y-2 backdrop-blur-md">
                    <div className="flex items-center gap-2 text-xs font-bold text-sky-300">
                      <Radio className="h-3.5 w-3.5 text-sky-400" />
                      <span>Telegram &amp; Push Dispatched</span>
                    </div>
                    <p className="text-[11px] text-slate-200 line-clamp-2">
                      ✈️ DEL → BOM dropped to ₹3,720! Book immediately before seat inventory rebounds.
                    </p>
                    <div className="flex items-center justify-between text-[11px] font-bold text-sky-400 pt-1">
                      <span>Latency: 240ms</span>
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* =========================================================================
            SECTION 1: HOW AERODROP WORKS — 3-STEP CHRONOLOGICAL EDITORIAL PROCESS
            ========================================================================= */}
        <section id="how-it-works" className="py-20 sm:py-28 border-t border-[var(--border)] bg-[#080d1a]/50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-2xl mx-auto space-y-3 mb-16">
              <span className="text-xs font-bold uppercase tracking-widest text-sky-400">
                Methodology
              </span>
              <h2 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-[var(--foreground)]">
                How AeroDrop Automates Your Savings
              </h2>
              <p className="text-sm sm:text-base text-[var(--muted-foreground)] leading-relaxed">
                Airline ticket pricing changes every 2 to 6 hours based on seat inventory algorithms. AeroDrop tracks the exact inflection points.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {/* Step 1 */}
              <div className="relative rounded-3xl border border-[var(--border)] bg-[#0b1120] p-7 space-y-4 shadow-lg hover:border-sky-500/30 transition-all">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-3xl font-black text-sky-400/40">01</span>
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
                    <Search className="h-5 w-5" />
                  </div>
                </div>
                <h3 className="text-lg font-bold text-[var(--foreground)]">
                  Select Route &amp; Target Price
                </h3>
                <p className="text-xs sm:text-sm text-[var(--muted-foreground)] leading-relaxed">
                  Choose origin and destination from over 10,000 IATA airports. Set your maximum desired budget in any supported global currency.
                </p>
              </div>

              {/* Step 2 */}
              <div className="relative rounded-3xl border border-[var(--border)] bg-[#0b1120] p-7 space-y-4 shadow-lg hover:border-sky-500/30 transition-all">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-3xl font-black text-blue-400/40">02</span>
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-500/10 text-sky-400 border border-sky-500/20">
                    <Clock className="h-5 w-5" />
                  </div>
                </div>
                <h3 className="text-lg font-bold text-[var(--foreground)]">
                  Autonomous 4-Hour Scan
                </h3>
                <p className="text-xs sm:text-sm text-[var(--muted-foreground)] leading-relaxed">
                  Our deduplication engine polls live flight APIs every 4 hours around the clock. Multiple users tracking the same route share 1 scan for zero resource waste.
                </p>
              </div>

              {/* Step 3 */}
              <div className="relative rounded-3xl border border-[var(--border)] bg-[#0b1120] p-7 space-y-4 shadow-lg hover:border-sky-500/30 transition-all">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-3xl font-black text-emerald-400/40">03</span>
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    <Radio className="h-5 w-5" />
                  </div>
                </div>
                <h3 className="text-lg font-bold text-[var(--foreground)]">
                  Instant Multi-Channel Dispatch
                </h3>
                <p className="text-xs sm:text-sm text-[var(--muted-foreground)] leading-relaxed">
                  The millisecond an airline drops their fare below your target, you receive an instant alert on your Telegram bot, email, and native browser push.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* =========================================================================
            SECTION 2: MULTI-SITE METASEARCH COVERAGE
            ========================================================================= */}
        <section id="metasearch" className="py-20 sm:py-28 border-t border-[var(--border)]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
              <div className="lg:col-span-5 space-y-5">
                <span className="text-xs font-bold uppercase tracking-widest text-sky-400">
                  Verification &amp; Transparency
                </span>
                <h2 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-[var(--foreground)] leading-tight">
                  Direct 1-Click Verification Across 6 Global Engines
                </h2>
                <p className="text-sm sm:text-base text-[var(--muted-foreground)] leading-relaxed">
                  AeroDrop never locks you into a single provider. Every tracker includes direct deep-links to verify and cross-check prices on major metasearch aggregators and OTAs:
                </p>
                <div className="space-y-2.5 pt-2">
                  <div className="flex items-center gap-2.5 text-xs font-semibold text-slate-300">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                    <span>Google Flights — Real-time direct carrier calendar matrices</span>
                  </div>
                  <div className="flex items-center gap-2.5 text-xs font-semibold text-slate-300">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                    <span>Skyscanner — Aggregates 1,200+ airlines &amp; low-cost carriers</span>
                  </div>
                  <div className="flex items-center gap-2.5 text-xs font-semibold text-slate-300">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                    <span>MakeMyTrip &amp; EaseMyTrip — Indian domestic &amp; international flash discounts</span>
                  </div>
                  <div className="flex items-center gap-2.5 text-xs font-semibold text-slate-300">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                    <span>Kayak &amp; Aviasales — Multi-airline hacker fares &amp; booking discounters</span>
                  </div>
                </div>
              </div>

              {/* Provider Badges Grid */}
              <div className="lg:col-span-7 grid grid-cols-2 sm:grid-cols-3 gap-4">
                {[
                  { name: "Google Flights", tag: "Carrier Directs", desc: "Official direct pricing matrices" },
                  { name: "Skyscanner", tag: "Global Search", desc: "1,200+ airline catalog reach" },
                  { name: "MakeMyTrip", tag: "Leading OTA", desc: "Domestic cashback & bank deals" },
                  { name: "EaseMyTrip", tag: "Zero Convenience", desc: "Lowest net checkout totals" },
                  { name: "Kayak", tag: "Hacker Fares", desc: "Split-ticket pricing combinations" },
                  { name: "Aviasales", tag: "Flight Aggregator", desc: "Worldwide multi-agency coverage" },
                ].map((item) => (
                  <div key={item.name} className="rounded-2xl border border-[var(--border)] bg-[#0b1120] p-4 space-y-1.5 shadow-sm hover:border-sky-500/30 transition-all">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-sky-400">
                      {item.tag}
                    </span>
                    <h4 className="text-sm font-bold text-[var(--foreground)]">{item.name}</h4>
                    <p className="text-[11px] text-[var(--muted-foreground)] leading-normal">
                      {item.desc}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* =========================================================================
            SECTION 3: RADAR INTELLIGENCE FEATURES
            ========================================================================= */}
        <section id="features" className="py-20 sm:py-28 border-t border-[var(--border)] bg-[#080d1a]/50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-2xl mx-auto space-y-3 mb-16">
              <span className="text-xs font-bold uppercase tracking-widest text-sky-400">
                Capabilities
              </span>
              <h2 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-[var(--foreground)]">
                Engineered for High-Frequency Precision
              </h2>
              <p className="text-sm sm:text-base text-[var(--muted-foreground)] leading-relaxed">
                Built with modern aviation technology standards to keep you ahead of dynamic ticket pricing algorithms.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Feature 1 */}
              <div className="rounded-3xl border border-[var(--border)] bg-[#0b1120] p-8 space-y-4 shadow-lg">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
                  <LineChart className="h-5 w-5" />
                </div>
                <h3 className="text-xl font-bold text-[var(--foreground)]">
                  30-Day Historical Trend Analytics
                </h3>
                <p className="text-sm text-[var(--muted-foreground)] leading-relaxed">
                  Understand whether today&apos;s ticket price is actually a good deal. Every route tracker captures high, low, and median fares with interactive SVG area charts to visualize pricing dips.
                </p>
              </div>

              {/* Feature 2 */}
              <div className="rounded-3xl border border-[var(--border)] bg-[#0b1120] p-8 space-y-4 shadow-lg">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <Zap className="h-5 w-5" />
                </div>
                <h3 className="text-xl font-bold text-[var(--foreground)]">
                  Progressive Web App (PWA) &amp; Native Push
                </h3>
                <p className="text-sm text-[var(--muted-foreground)] leading-relaxed">
                  Install AeroDrop straight to your desktop dock or mobile home screen. Receive background native web push alerts without needing App Store or Play Store downloads.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* =========================================================================
            SECTION 4: ZERO-COST TRANSPARENCY
            ========================================================================= */}
        <section id="transparency" className="py-20 sm:py-28 border-t border-[var(--border)]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center max-w-3xl space-y-6">
            <span className="text-xs font-bold uppercase tracking-widest text-sky-400">
              Zero Hidden Costs
            </span>
            <h2 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-[var(--foreground)]">
              No Subscriptions. No Cards Required.
            </h2>
            <p className="text-sm sm:text-base text-[var(--muted-foreground)] leading-relaxed">
              AeroDrop is powered by an efficient, zero-cost architecture utilizing Supabase PostgreSQL, official Telegram Bot APIs, direct W3C VAPID Web Push, and custom SMTP email delivery.
            </p>
          </div>
        </section>

        {/* =========================================================================
            SECTION 5: FINAL CALL TO ACTION (WITH AVIATION BACKDROP)
            ========================================================================= */}
        <section className="relative overflow-hidden py-24 sm:py-32 border-t border-[var(--border)] text-center">
          {/* Background Aviation Photograph */}
          <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden select-none">
            <Image
              src="/images/airplane-wing-twilight.webp"
              alt="Aviation sunset wing"
              fill
              sizes="100vw"
              className="object-cover object-center opacity-40 dark:opacity-35"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#060913] via-[#060913]/85 to-[#060913]/90" />
          </div>

          <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
            <h2 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-white leading-tight">
              Ready to automate your flight price tracking?
            </h2>
            <p className="text-sm sm:text-base text-slate-300 max-w-xl mx-auto leading-relaxed">
              Create your first route tracker in 30 seconds. Connect your Telegram account and let AeroDrop do the heavy lifting.
            </p>
            <div className="pt-2">
              <Link href={user ? "/dashboard" : "/signup"}>
                <Button size="lg" className="min-h-[50px] px-9 gap-2 text-base font-bold shadow-xl bg-blue-600 hover:bg-blue-500 text-white rounded-xl">
                  <span>{user ? "Open Flight Radar" : "Start Tracking Now — 100% Free"}</span>
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-[var(--border)] bg-[#050811] py-10 px-4 sm:px-6 lg:px-8 text-xs text-[var(--muted-foreground)]">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-6">
          <AeroDropLogo variant="full" size="sm" href="/" />
          
          <div className="flex items-center gap-5 text-slate-400">
            <span>Next.js 15 SSR</span>
            <span>·</span>
            <span>Supabase PostgreSQL</span>
            <span>·</span>
            <span>Telegram Bot API</span>
            <span>·</span>
            <span>W3C Web Push</span>
          </div>

          <p className="text-slate-500">
            © 2026 AeroDrop · Autonomous Travel Intelligence
          </p>
        </div>
      </footer>
    </div>
  );
}
