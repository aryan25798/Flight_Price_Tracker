import Link from "next/link";
import {
  Activity,
  ArrowRight,
  Bell,
  CheckCircle2,
  Clock,
  ExternalLink,
  PauseCircle,
  Plane,
  PlaneTakeoff,
  Radio,
  Sparkles,
  TrendingDown,
  Wallet,
  Zap,
} from "lucide-react";
import { createClient, getAuthenticatedProfile } from "@/lib/supabase/server";
import { FlightSearchForm } from "@/components/dashboard/flight-search-form";
import { TrackersTable } from "@/components/dashboard/trackers-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";
import type { TrackedFlight } from "@/types/database";

const PAGE_SIZE = 10;

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; origin?: string; destination?: string }>;
}) {
  const { user, profile } = await getAuthenticatedProfile();
  const params = await searchParams;
  const page = Math.max(1, Number(params.page ?? "1") || 1);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const supabase = await createClient();

  const [
    { count: totalCount, data: trackersData },
    { count: activeCount },
    { count: dropsCount },
  ] = await Promise.all([
    supabase
      .from("tracked_flights")
      .select(
        "id, user_id, route_id, origin, destination, departure_date, return_date, trip_type, adults, children, infants, cabin_class, currency, target_price, last_seen_price, last_notified_price, last_notified_at, is_active, created_at, updated_at, monitored_routes(last_checked_at, last_airline, last_booking_url, status)",
        { count: "exact" },
      )
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .range(from, to),
    supabase
      .from("tracked_flights")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("is_active", true),
    supabase
      .from("notification_logs")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("notification_type", "price_drop")
      .eq("delivery_status", "sent"),
  ]);

  const pausedCount = Math.max(0, (totalCount ?? 0) - (activeCount ?? 0));

  const trackers = (trackersData ?? []) as unknown as TrackedFlight[];
  const telegramLinked = Boolean(profile.telegram_chat_id);
  const displayName = profile.email?.split("@")[0] || "Traveler";

  // User Tier & Quota Calculation
  const isSuperAdmin = profile.role === "super_admin";
  const userTier = profile.tier || "free";
  const isUnlimited =
    isSuperAdmin ||
    profile.custom_tracker_limit === -1 ||
    (userTier === "enterprise" && profile.custom_tracker_limit === null);

  const effectiveLimit = isUnlimited
    ? -1
    : profile.custom_tracker_limit !== null && profile.custom_tracker_limit !== undefined
      ? profile.custom_tracker_limit
      : userTier === "pro"
        ? 25
        : 3;

  const currentActive = activeCount ?? 0;
  const remaining = isUnlimited ? 9999 : Math.max(0, effectiveLimit - currentActive);

  const userQuota = {
    tier: userTier,
    effective_limit: effectiveLimit,
    current_count: currentActive,
    is_unlimited: isUnlimited,
    remaining,
  };

  // Calculate Best Deal route or lowest recorded fare from trackers
  const lowestFareTracker = trackers.reduce<TrackedFlight | null>((best, curr) => {
    if (!curr.last_seen_price) return best;
    if (!best || !best.last_seen_price) return curr;
    return curr.last_seen_price < best.last_seen_price ? curr : best;
  }, null);

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Top Welcome & Telegram Connectivity Bar */}
      <div className="relative overflow-hidden rounded-2xl glass-surface-1 p-5 sm:p-7 shadow-xl border border-[var(--border)]">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-sky-500/30 bg-sky-500/10 px-3 py-0.5 text-xs font-semibold text-sky-300 shadow-2xs backdrop-blur-md">
                <span className="h-1.5 w-1.5 rounded-full bg-sky-400 animate-pulse shadow-[0_0_6px_rgba(56,189,248,0.8)]" />
                <span>Live Flight Radar</span>
              </span>
              <span className="text-xs text-[var(--muted-foreground)]">
                {isUnlimited
                  ? `${isSuperAdmin ? "Super Admin" : "Enterprise VIP"} · Unlimited Trackers (∞)`
                  : `${userTier === "pro" ? "Pro Plan" : "Free Tier"} · ${currentActive}/${effectiveLimit} Active Trackers`}
              </span>
            </div>

            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[var(--foreground)]">
              Good day, <span className="text-transparent bg-clip-text bg-gradient-to-r from-sky-400 to-cyan-300">{displayName}</span>! 👋
            </h2>
            <p className="max-w-2xl text-xs sm:text-sm text-[var(--muted-foreground)] leading-relaxed">
              Your flight routes are continuously scanned every 4 hours against cached airline fares. Target drops bypass cooldowns and notify you instantly on Telegram.
            </p>
          </div>

          {/* Telegram Status Callout */}
          <div className="flex items-center gap-3.5 shrink-0 rounded-2xl glass-surface-2 p-4 border border-[var(--border)] shadow-xs">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-sky-500/15 text-sky-400 border border-sky-500/30 shadow-[0_0_15px_rgba(56,189,248,0.2)]">
              <Radio className="h-5 w-5" />
            </div>
            <div className="space-y-1">
              <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted-foreground)]">
                Telegram Alerts
              </p>
              {telegramLinked ? (
                <div className="flex items-center gap-2">
                  <Badge variant="success" dot className="text-xs">
                    Connected
                  </Badge>
                  <span className="text-[11px] text-[var(--muted-foreground)] font-mono">
                    ID: {profile.telegram_chat_id?.slice(-4).padStart(8, "•")}
                  </span>
                </div>
              ) : (
                <Link
                  href="/dashboard/settings"
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-400 hover:text-amber-300 hover:underline"
                >
                  <span>Connect Bot Now</span>
                  <ArrowRight className="h-3 w-3" />
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 4 Precision Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
        {/* Metric 1: Active Trackers */}
        <div className="rounded-2xl border border-[var(--border)] bg-[#0b1120] p-4 sm:p-5 space-y-2.5 shadow-sm hover:border-sky-500/30 transition-all">
          <div className="flex items-center justify-between text-[var(--muted-foreground)]">
            <span className="text-xs font-semibold text-slate-400">Active Trackers</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
              <Plane className="h-4 w-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl sm:text-3xl font-extrabold tabular-nums text-[var(--foreground)]">
              {currentActive}
            </span>
            <span className="text-xs font-semibold text-slate-500">
              / {isUnlimited ? "∞" : effectiveLimit}
            </span>
            <span className="text-xs font-semibold text-emerald-400 flex items-center ml-auto">
              ● live
            </span>
          </div>
          <p className="text-[11px] text-slate-400 truncate">
            {isUnlimited
              ? `${totalCount ?? 0} total · uncapped quota`
              : `${remaining} remaining · ${totalCount ?? 0} total`}
          </p>
        </div>

        {/* Metric 2: Price Drops Sent */}
        <div className="rounded-2xl border border-[var(--border)] bg-[#0b1120] p-4 sm:p-5 space-y-2.5 shadow-sm hover:border-sky-500/30 transition-all">
          <div className="flex items-center justify-between text-[var(--muted-foreground)]">
            <span className="text-xs font-semibold text-slate-400">Price Drops</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <TrendingDown className="h-4 w-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-extrabold tabular-nums text-amber-400">
              {dropsCount ?? 0}
            </span>
            <span className="text-xs text-slate-400">alerts sent</span>
          </div>
          <p className="text-[11px] text-slate-400 truncate">
            Telegram &amp; email notifications
          </p>
        </div>

        {/* Metric 3: Scan Engine */}
        <div className="rounded-2xl border border-[var(--border)] bg-[#0b1120] p-4 sm:p-5 space-y-2.5 shadow-sm hover:border-sky-500/30 transition-all">
          <div className="flex items-center justify-between text-[var(--muted-foreground)]">
            <span className="text-xs font-semibold text-slate-400">Scan Cycle</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <CheckCircle2 className="h-4 w-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-extrabold tabular-nums text-[var(--foreground)]">
              4h
            </span>
            <span className="text-xs text-emerald-400 font-semibold">
              active
            </span>
          </div>
          <p className="text-[11px] text-slate-400 truncate">
            Automated background checks
          </p>
        </div>

        {/* Metric 4: Best Deal */}
        <div className="rounded-2xl border border-[var(--border)] bg-[#0b1120] p-4 sm:p-5 space-y-2.5 shadow-sm hover:border-sky-500/30 transition-all">
          <div className="flex items-center justify-between text-[var(--muted-foreground)]">
            <span className="text-xs font-semibold text-slate-400">Lowest Recorded</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-sky-500/10 text-sky-400 border border-sky-500/20">
              <PlaneTakeoff className="h-4 w-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-extrabold tabular-nums text-sky-400">
              {lowestFareTracker?.last_seen_price
                ? formatCurrency(lowestFareTracker.last_seen_price, lowestFareTracker.currency)
                : "₹6,422"}
            </span>
            <span className="text-xs text-slate-400 uppercase font-mono">
              {lowestFareTracker ? `${lowestFareTracker.origin}→${lowestFareTracker.destination}` : "DEL→BOM"}
            </span>
          </div>
          <p className="text-[11px] text-slate-400 truncate">
            Lowest fare in your radar
          </p>
        </div>
      </div>

      {/* Flight Search & Route Configuration Form ("Track Your Next Flight") */}
      <section aria-label="Add new route to monitor">
        <FlightSearchForm
          initialOrigin={params.origin}
          initialDestination={params.destination}
          quotaInfo={userQuota}
        />
      </section>

      {/* Active & Historical Trackers Section ("Your Active Flight Trackers") */}
      <section aria-label="Tracked flight routes table">
        <TrackersTable
          trackers={trackers}
          total={totalCount ?? 0}
          page={page}
          pageSize={PAGE_SIZE}
          basePath="/dashboard"
        />
      </section>
    </div>
  );
}
