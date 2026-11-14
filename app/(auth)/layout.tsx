import Image from "next/image";
import Link from "next/link";
import {
  Bell,
  CheckCircle2,
  LineChart,
  Radio,
  ShieldCheck,
  Sparkles,
  TrendingDown,
} from "lucide-react";
import { AeroDropLogo } from "@/components/brand/aerodrop-logo";
import { ThemeToggle } from "@/components/shared/theme-toggle";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen w-full flex flex-col justify-between ambient-night-mesh selection:bg-sky-500/25 overflow-x-hidden">
      {/* Background aviation atmosphere */}
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden opacity-25 dark:opacity-20">
        <Image
          src="/images/airplane-clouds-soaring.webp"
          alt="Aviation sky backdrop"
          fill
          priority
          sizes="100vw"
          className="object-cover object-[center_30%]"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-[#060913]/70 via-[#060913]/90 to-[#060913]" />
      </div>

      {/* Top Header */}
      <header className="relative z-20 shrink-0 flex h-16 items-center justify-between px-4 sm:px-8 max-w-7xl mx-auto w-full">
        <AeroDropLogo variant="full" size="md" href="/" />
        <ThemeToggle />
      </header>

      {/* Main Dual-Column Hero & Card Container */}
      <main className="relative z-10 flex-1 flex items-center justify-center px-4 py-6 sm:py-8 lg:py-12">
        <div className="mx-auto w-full max-w-5xl grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
          
          {/* Left Column: Visual Aviation Showcase & Precision Product Value Props (Desktop) */}
          <div className="lg:col-span-6 hidden lg:block">
            <div className="relative overflow-hidden rounded-3xl glass-surface-1 border border-[var(--border)] p-7 xl:p-9 shadow-2xl space-y-6">
              {/* Background Aviation Photograph - Clearly visible with beautiful sky lighting */}
              <div className="absolute inset-0 z-0 overflow-hidden">
                <Image
                  src="/images/airplane-wing-twilight.webp"
                  alt="Airliner cruising gracefully over golden twilight cloudscapes"
                  fill
                  priority
                  sizes="(max-width: 1200px) 50vw, 600px"
                  className="object-cover object-center opacity-60 dark:opacity-55"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#0a0f1d] via-[#0a0f1d]/70 to-[#0a0f1d]/40" />
              </div>

              {/* Foreground Storytelling */}
              <div className="relative z-10 space-y-5">
                <div className="inline-flex items-center gap-2 rounded-full border border-sky-400/30 bg-sky-500/10 px-3.5 py-1 text-xs font-semibold text-sky-300 shadow-sm backdrop-blur-md">
                  <Sparkles className="h-3.5 w-3.5 text-sky-400" />
                  <span>Modern Aviation Intelligence</span>
                </div>

                <h1 className="text-2xl xl:text-3xl font-extrabold tracking-tight text-white leading-tight">
                  Autonomous flight price tracking for precision travelers.
                </h1>

                <p className="text-xs xl:text-sm text-slate-300 leading-relaxed">
                  AeroDrop scans global airfares every 4 hours across 100+ airlines. Receive instant alerts on Telegram, Email, and Browser Push the moment fares drop below your custom threshold.
                </p>

                {/* Feature Micro-Items */}
                <div className="space-y-2.5 pt-1">
                  <div className="flex items-center gap-3 rounded-xl bg-slate-900/70 p-3 border border-white/10 backdrop-blur-md">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-500/15 text-blue-400 border border-blue-500/25">
                      <LineChart className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-xs font-bold text-white">4-Hour Autonomous Price Scans</h4>
                      <p className="text-[11px] text-slate-300 truncate">24/7 route monitoring with 30-day historical trend graphs</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 rounded-xl bg-slate-900/70 p-3 border border-white/10 backdrop-blur-md">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-400 border border-emerald-500/25">
                      <Radio className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-xs font-bold text-white">Triple-Channel Instant Alerts</h4>
                      <p className="text-[11px] text-slate-300 truncate">Immediate Telegram bot, custom SMTP email, &amp; browser push</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 rounded-xl bg-slate-900/70 p-3 border border-white/10 backdrop-blur-md">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sky-500/15 text-sky-400 border border-sky-500/25">
                      <TrendingDown className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-xs font-bold text-white">Multi-Site Metasearch Verification</h4>
                      <p className="text-[11px] text-slate-300 truncate">1-click verification across Google Flights, Skyscanner &amp; OTAs</p>
                    </div>
                  </div>
                </div>

                {/* Live Member Trust Badge */}
                <div className="flex items-center gap-2.5 pt-2 text-xs text-slate-300 border-t border-white/10">
                  <div className="flex -space-x-1.5">
                    <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-[9px] font-bold text-white ring-1 ring-white/20">DEL</span>
                    <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-sky-600 text-[9px] font-bold text-white ring-1 ring-white/20">BOM</span>
                    <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-600 text-[9px] font-bold text-white ring-1 ring-white/20">LHR</span>
                  </div>
                  <span>Monitoring over <strong>8,700+</strong> global flight routes daily</span>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Authentication Card Form */}
          <div className="w-full lg:col-span-6 flex justify-center lg:justify-end">
            <div className="w-full max-w-[420px]">
              {children}
            </div>
          </div>

        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-20 shrink-0 py-4 text-center text-xs text-[var(--muted-foreground)]">
        <span>© 2026 AeroDrop · Autonomous Travel Intelligence</span>
      </footer>
    </div>
  );
}
