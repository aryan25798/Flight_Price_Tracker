"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowRight,
  Bell,
  Calendar,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Globe,
  LineChart,
  Pause,
  Plane,
  Play,
  Radio,
  Search,
  Sparkles,
  Store,
  Tag,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { deleteTrackerAction, toggleTrackerAction } from "@/app/dashboard/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { PaginationBar } from "@/components/ui/pagination-bar";
import { formatCurrency, formatDateShort, formatRelativeTime } from "@/lib/utils";
import { generateMultiSiteComparisonLinks } from "@/lib/flight-urls";
import type { TrackedFlight } from "@/types/database";
import { cn } from "@/lib/utils";

const LazyPriceHistoryChart = dynamic(
  () => import("@/components/charts/price-history-chart").then((m) => m.PriceHistoryChart),
  {
    ssr: false,
    loading: () => <Skeleton className="h-80 w-full rounded-2xl" />,
  },
);

interface TrackersTableProps {
  trackers: TrackedFlight[];
  total: number;
  page: number;
  pageSize: number;
  basePath?: string;
  initialSearch?: string;
  initialStatus?: string;
}

export function TrackersTable({
  trackers,
  total,
  page,
  pageSize,
  basePath = "/dashboard",
  initialSearch = "",
  initialStatus = "all",
}: TrackersTableProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [chartTracker, setChartTracker] = React.useState<TrackedFlight | null>(null);
  const [compareTracker, setCompareTracker] = React.useState<TrackedFlight | null>(null);
  const [deleteTarget, setDeleteTarget] = React.useState<TrackedFlight | null>(null);

  const [searchInput, setSearchInput] = React.useState(initialSearch);
  const [currentStatus, setCurrentStatus] = React.useState(initialStatus);

  React.useEffect(() => {
    setSearchInput(initialSearch);
  }, [initialSearch]);

  React.useEffect(() => {
    setCurrentStatus(initialStatus);
  }, [initialStatus]);

  const createPageUrl = (targetPage: number) => {
    const sp = new URLSearchParams(searchParams.toString());
    sp.set("page", String(targetPage));
    if (pageSize) sp.set("pageSize", String(pageSize));
    return `${basePath}?${sp.toString()}`;
  };

  const handlePageSizeChange = (newSize: number) => {
    const sp = new URLSearchParams(searchParams.toString());
    sp.set("page", "1");
    sp.set("pageSize", String(newSize));
    router.push(`${basePath}?${sp.toString()}`);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const sp = new URLSearchParams(searchParams.toString());
    if (searchInput.trim()) sp.set("search", searchInput.trim());
    else sp.delete("search");
    sp.set("page", "1");
    router.push(`${basePath}?${sp.toString()}`);
  };

  const handleStatusFilter = (newStatus: "all" | "active" | "paused") => {
    setCurrentStatus(newStatus);
    const sp = new URLSearchParams(searchParams.toString());
    if (newStatus !== "all") sp.set("status", newStatus);
    else sp.delete("status");
    sp.set("page", "1");
    router.push(`${basePath}?${sp.toString()}`);
  };

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  async function handleToggle(tracker: TrackedFlight) {
    setBusyId(tracker.id);
    try {
      const res = await toggleTrackerAction(tracker.id, !tracker.is_active);
      if (!res.ok) toast.error(res.message);
      else toast.success(res.message);
    } finally {
      setBusyId(null);
    }
  }

  async function handleConfirmDelete() {
    if (!deleteTarget) return;
    setBusyId(deleteTarget.id);
    try {
      const res = await deleteTrackerAction(deleteTarget.id);
      if (!res.ok) toast.error(res.message);
      else {
        toast.success(res.message);
        setDeleteTarget(null);
      }
    } finally {
      setBusyId(null);
    }
  }

  const comparisonSites = compareTracker
    ? generateMultiSiteComparisonLinks({
        origin: compareTracker.origin,
        destination: compareTracker.destination,
        departureDate: compareTracker.departure_date,
        returnDate: compareTracker.return_date,
        tripType: compareTracker.trip_type as "one_way" | "round_trip",
      })
    : [];

  return (
    <>
      <Card className="glass-surface-1 border-[var(--border)] shadow-xl overflow-hidden">
        <CardHeader className="border-b border-[var(--border)] glass-surface-2/40 pb-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2.5">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <Radio className="h-4 w-4" />
                </span>
                <CardTitle className="text-base sm:text-lg font-bold tracking-tight text-[var(--foreground)]">
                  Active Flight Trackers
                </CardTitle>
              </div>
              <CardDescription className="text-xs sm:text-sm">
                {total} {total === 1 ? "route" : "routes"} actively monitored via automated cron cycles.
              </CardDescription>
            </div>

            {/* Live Filter & Route Search Bar */}
            <div className="flex flex-wrap items-center gap-2.5">
              <form onSubmit={handleSearchSubmit} className="relative flex-1 sm:w-56">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-[var(--muted-foreground)]" />
                <input
                  type="text"
                  placeholder="Filter route (e.g. DEL)..."
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  className="h-8 w-full rounded-xl border border-[var(--border)] bg-[var(--card)] pl-8 pr-2.5 text-xs text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-1 focus:ring-sky-500"
                />
              </form>

              <div className="flex items-center gap-1 rounded-xl border border-[var(--border)] bg-[var(--card)] p-0.5 text-xs">
                {(["all", "active", "paused"] as const).map((st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => handleStatusFilter(st)}
                    className={cn(
                      "px-2.5 py-1 rounded-lg font-semibold capitalize transition-all cursor-pointer",
                      currentStatus === st
                        ? "bg-sky-500/20 text-sky-300 font-bold"
                        : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]",
                    )}
                  >
                    {st}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {trackers.length === 0 ? (
            <div className="p-12 text-center space-y-3">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-500/15 text-sky-400 border border-sky-500/30">
                <Plane className="h-6 w-6" />
              </div>
              <p className="text-sm font-bold text-[var(--foreground)]">No flight trackers yet</p>
              <p className="text-xs text-[var(--muted-foreground)] max-w-sm mx-auto leading-relaxed">
                Configure your first flight route above with your target price. AeroDrop will automatically monitor fares 24/7.
              </p>
            </div>
          ) : (
            <>
              {/* MOBILE VIEW: Boarding-Pass Luxury Travel Cards (< 768px) */}
              <div className="divide-y divide-[var(--border)] md:hidden">
                {trackers.map((t) => {
                  const isBelowTarget = t.last_seen_price && t.last_seen_price <= t.target_price;
                  const discountPct =
                    t.last_seen_price && t.last_seen_price < t.target_price
                      ? Math.round(((t.target_price - t.last_seen_price) / t.target_price) * 100)
                      : null;
                  const bookingUrl = t.monitored_routes?.last_booking_url;

                  return (
                    <div
                      key={t.id}
                      className="p-4 space-y-3.5 glass-surface-1 hover:bg-[var(--glass-surface-2)] transition-colors"
                    >
                      {/* Route Header & Status Pill */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-base font-extrabold tracking-tight text-[var(--foreground)]">
                            {t.origin}
                          </span>
                          <ArrowRight className="h-4 w-4 text-sky-400" />
                          <span className="font-mono text-base font-extrabold tracking-tight text-[var(--foreground)]">
                            {t.destination}
                          </span>
                        </div>

                        <Badge
                          variant={t.is_active ? "success" : "secondary"}
                          dot
                          className="shrink-0 text-xs font-semibold"
                        >
                          {t.is_active ? (isBelowTarget ? "Deal Active" : "Monitoring") : "Paused"}
                        </Badge>
                      </div>

                      {/* Flight Details Row */}
                      <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--muted-foreground)]">
                        {t.flight_number && (
                          <span className="font-mono text-[11px] font-bold text-sky-400 bg-sky-950/60 px-1.5 py-0.5 rounded border border-sky-500/30">
                            {t.airline_name ? `${t.airline_name} ` : ""}{t.flight_number}
                          </span>
                        )}
                        <span className="inline-flex items-center gap-1 font-semibold text-[var(--foreground)]">
                          <Calendar className="h-3 w-3 text-sky-400" />
                          {formatDateShort(t.departure_date)}
                        </span>
                        {t.departure_time && <span>· Dep: {t.departure_time}</span>}
                        {t.return_date && <span>· Ret: {formatDateShort(t.return_date)}</span>}
                        <span>· {t.trip_type === "round_trip" ? "Round-trip" : "One-way"}</span>
                        <span>· {(t.cabin_class?.replace("_", " ") ?? "economy")}</span>
                      </div>

                      {/* Pricing Comparison Box */}
                      <div className="grid grid-cols-2 gap-2 rounded-xl border border-[var(--border)] glass-surface-2 p-3">
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted-foreground)]">
                            Target Alert
                          </p>
                          <p className="font-mono text-sm font-bold text-[var(--foreground)]">
                            {formatCurrency(t.target_price, t.currency)}
                          </p>
                        </div>
                        <div className="border-l border-[var(--border)] pl-3">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted-foreground)]">
                            Latest Rate
                          </p>
                          <div className="flex items-center gap-1.5">
                            <span
                              className={cn(
                                "font-mono text-sm font-black",
                                isBelowTarget
                                  ? "text-emerald-400"
                                  : "text-[var(--foreground)]",
                              )}
                            >
                              {formatCurrency(t.last_seen_price, t.currency)}
                            </span>
                            {bookingUrl && (
                              <a
                                href={bookingUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-sky-400 hover:text-sky-300"
                                title="Book flight"
                              >
                                <ExternalLink className="h-3 w-3" />
                              </a>
                            )}
                          </div>
                          {t.monitored_routes?.last_airline && (
                            <p className="text-[10px] text-[var(--muted-foreground)] truncate">
                              {t.monitored_routes.last_airline}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Savings Highlight Badge */}
                      {discountPct && discountPct > 0 && (
                        <div className="inline-flex items-center gap-1 rounded-lg bg-emerald-500/15 border border-emerald-500/30 px-2.5 py-1 text-[11px] font-bold text-emerald-300">
                          <span>⚡ {discountPct}% below target! Alert sent on Telegram</span>
                        </div>
                      )}

                      {/* Mobile Action Buttons (Min 44px tap targets) */}
                      <div className="flex flex-wrap items-center justify-between pt-1 gap-2">
                        <span className="text-[11px] text-[var(--muted-foreground)]">
                          Checked {formatRelativeTime(t.monitored_routes?.last_checked_at)}
                        </span>

                        <div className="flex items-center gap-1.5 flex-wrap">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-9 px-3 gap-1 text-xs font-bold text-sky-400 border-sky-500/30"
                            onClick={() => setCompareTracker(t)}
                          >
                            <Globe className="h-3.5 w-3.5" />
                            <span>Compare Sites</span>
                          </Button>

                          <Button
                            variant="outline"
                            size="sm"
                            className="h-9 px-3 gap-1 text-xs font-bold"
                            onClick={() => setChartTracker(t)}
                          >
                            <LineChart className="h-3.5 w-3.5 text-sky-400" />
                            <span>History</span>
                          </Button>

                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-9 px-2.5 text-xs rounded-xl"
                            disabled={busyId === t.id}
                            onClick={() => handleToggle(t)}
                            title={t.is_active ? "Pause tracker" : "Resume tracker"}
                          >
                            {t.is_active ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                          </Button>

                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-9 px-2.5 text-xs text-red-400 hover:text-red-300 hover:bg-red-500/15 rounded-xl"
                            onClick={() => setDeleteTarget(t)}
                            title="Delete tracker"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* DESKTOP VIEW: High-Density Luxury Glass Table (>= 768px) */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-[var(--border)] bg-slate-900/60 text-xs font-semibold text-slate-400">
                      <th className="py-3 px-5">Route</th>
                      <th className="py-3 px-4">Departure / Return</th>
                      <th className="py-3 px-4">Target Alert</th>
                      <th className="py-3 px-4">Latest Seen Price</th>
                      <th className="py-3 px-4">Last Inspected</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border)]">
                    {trackers.map((t) => {
                      const isBelowTarget = t.last_seen_price && t.last_seen_price <= t.target_price;
                      const bookingUrl = t.monitored_routes?.last_booking_url;

                      return (
                        <tr key={t.id} className="hover:bg-[var(--glass-surface-2)] transition-colors">
                          <td className="py-3.5 px-5">
                            <div className="flex items-center gap-2 font-bold font-mono">
                              <span className="text-sm">{t.origin}</span>
                              <ArrowRight className="h-3.5 w-3.5 text-sky-400" />
                              <span className="text-sm">{t.destination}</span>
                              {t.flight_number && (
                                <span className="text-[10px] font-mono font-bold text-sky-400 bg-sky-950/60 px-1.5 py-0.5 rounded border border-sky-500/30">
                                  {t.airline_name ? `${t.airline_name} ` : ""}{t.flight_number}
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-[var(--muted-foreground)]">
                              {t.trip_type === "round_trip" ? "Round-trip" : "One-way"} · {(t.cabin_class?.replace("_", " ") ?? "economy")}
                            </div>
                          </td>

                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <div className="font-semibold text-xs text-[var(--foreground)]">
                              {formatDateShort(t.departure_date)}
                              {t.departure_time && <span className="font-normal text-[var(--muted-foreground)] ml-1">({t.departure_time})</span>}
                            </div>
                            {t.return_date && (
                              <div className="text-[11px] text-[var(--muted-foreground)]">
                                Return: {formatDateShort(t.return_date)}
                              </div>
                            )}
                          </td>

                          <td className="py-3.5 px-4 font-mono font-bold text-xs tabular-nums whitespace-nowrap">
                            {formatCurrency(t.target_price, t.currency)}
                          </td>

                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              <span
                                className={cn(
                                  "font-mono font-black text-xs tabular-nums",
                                  isBelowTarget
                                    ? "text-emerald-400"
                                    : "text-[var(--foreground)]",
                                )}
                              >
                                {formatCurrency(t.last_seen_price, t.currency)}
                              </span>
                              {bookingUrl && (
                                <a
                                  href={bookingUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-sky-400 hover:text-sky-300 transition-colors"
                                  title="View on booking site"
                                >
                                  <ExternalLink className="h-3.5 w-3.5" />
                                </a>
                              )}
                            </div>
                            {t.monitored_routes?.last_airline && (
                              <div className="text-[11px] text-[var(--muted-foreground)] truncate max-w-[140px]">
                                {t.monitored_routes.last_airline}
                              </div>
                            )}
                          </td>

                          <td className="py-3.5 px-4 text-xs text-[var(--muted-foreground)] whitespace-nowrap">
                            {formatRelativeTime(t.monitored_routes?.last_checked_at)}
                          </td>

                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <Badge variant={t.is_active ? "success" : "secondary"} dot>
                              {t.is_active ? "Active" : "Paused"}
                            </Badge>
                          </td>

                          <td className="py-3.5 px-5 text-right whitespace-nowrap">
                            <div className="inline-flex items-center gap-1.5">
                              <Button
                                variant="ghost"
                                size="iconSm"
                                title="Compare live across Google Flights, Skyscanner, MakeMyTrip, EaseMyTrip..."
                                onClick={() => setCompareTracker(t)}
                                className="text-sky-400 hover:text-sky-300 hover:bg-sky-500/15 rounded-lg"
                              >
                                <Globe className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="iconSm"
                                title="View price history chart"
                                onClick={() => setChartTracker(t)}
                                className="rounded-lg text-[var(--muted-foreground)] hover:text-white"
                              >
                                <LineChart className="h-3.5 w-3.5 text-sky-400" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="iconSm"
                                disabled={busyId === t.id}
                                title={t.is_active ? "Pause tracker" : "Resume tracker"}
                                onClick={() => handleToggle(t)}
                                className="rounded-lg text-[var(--muted-foreground)] hover:text-white"
                              >
                                {t.is_active ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                              </Button>
                              <Button
                                variant="ghost"
                                size="iconSm"
                                className="text-red-400 hover:text-red-300 hover:bg-red-500/15 rounded-lg"
                                title="Delete tracker"
                                onClick={() => setDeleteTarget(t)}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {/* Pagination Footer */}
          {total > 0 && (
            <div className="px-5 pb-4">
              <PaginationBar
                page={page}
                pageSize={pageSize}
                total={total}
                createPageUrl={createPageUrl}
                pageSizeOptions={[10, 15, 25, 50]}
                onPageSizeChange={handlePageSizeChange}
                itemLabel="routes"
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Multi-Site Comparison Modal */}
      {compareTracker && (
        <Dialog
          open={Boolean(compareTracker)}
          onOpenChange={() => setCompareTracker(null)}
          title={`Compare Prices: ${compareTracker.origin} → ${compareTracker.destination}`}
          description={`Direct 1-click comparison across leading flight search engines for ${formatDateShort(compareTracker.departure_date)}`}
          maxWidthClass="max-w-2xl"
        >
          <div className="space-y-4">
            {/* Header Metrics */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 rounded-xl border border-[var(--border)] glass-surface-2 p-3 text-xs">
              <div>
                <p className="text-[var(--muted-foreground)] text-[10px] uppercase font-bold">Route</p>
                <p className="font-extrabold font-mono text-sm text-[var(--foreground)]">
                  {compareTracker.origin} → {compareTracker.destination}
                </p>
              </div>
              <div>
                <p className="text-[var(--muted-foreground)] text-[10px] uppercase font-bold">Target Alert</p>
                <p className="font-extrabold font-mono text-sm text-[var(--foreground)]">
                  {formatCurrency(compareTracker.target_price, compareTracker.currency)}
                </p>
              </div>
              <div>
                <p className="text-[var(--muted-foreground)] text-[10px] uppercase font-bold">Latest Seen Price</p>
                <p className="font-extrabold font-mono text-sm text-sky-400">
                  {formatCurrency(compareTracker.last_seen_price, compareTracker.currency)}
                </p>
              </div>
            </div>

            {/* Explanatory Banner */}
            <div className="rounded-xl border border-sky-500/20 bg-sky-500/10 p-3 text-xs text-[var(--muted-foreground)] flex items-start gap-2.5">
              <Sparkles className="h-4 w-4 text-sky-400 shrink-0 mt-0.5" />
              <div>
                <strong className="text-[var(--foreground)]">Multi-Site Metasearch Coverage:</strong> AeroDrop automatically monitors 100+ partner airlines and travel agencies in the background every 4 hours. You can also verify and compare live fares across these popular platforms in one click:
              </div>
            </div>

            {/* Sites Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pb-2">
              {comparisonSites.map((site) => (
                <div
                  key={site.id}
                  className="flex flex-col justify-between rounded-xl border border-[var(--border)] glass-surface-3 p-3.5 space-y-2.5 hover:border-sky-500/40 hover:shadow-xs transition-all"
                >
                  <div className="space-y-1">
                    <div className="flex items-center justify-between gap-1">
                      <span className="font-bold text-sm text-[var(--foreground)]">{site.name}</span>
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full border border-[var(--border)] bg-[var(--glass-surface-2)] text-[var(--muted-foreground)]">
                        {site.tag}
                      </span>
                    </div>
                    <p className="text-[11px] text-[var(--muted-foreground)] leading-relaxed">
                      {site.description}
                    </p>
                  </div>

                  <a
                    href={site.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-1.5 w-full rounded-xl bg-[var(--glass-surface-2)] hover:btn-glass-primary px-3 py-2 text-xs font-bold text-[var(--foreground)] hover:text-white transition-all border border-[var(--border)]"
                  >
                    <span>Check on {site.name}</span>
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              ))}
            </div>

            <div className="flex justify-end pt-3 pb-2 border-t border-[var(--border)]">
              <Button variant="outline" size="sm" onClick={() => setCompareTracker(null)}>
                Close
              </Button>
            </div>
          </div>
        </Dialog>
      )}

      {/* Historical Price Chart Dialog */}
      {chartTracker && (
        <Dialog
          open={Boolean(chartTracker)}
          onOpenChange={() => setChartTracker(null)}
          maxWidthClass="max-w-3xl"
        >
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
              <div>
                <h3 className="text-base sm:text-lg font-bold flex items-center gap-2">
                  <span>{chartTracker.origin}</span>
                  <ArrowRight className="h-4 w-4 text-sky-400" />
                  <span>{chartTracker.destination}</span>
                  <Badge variant="outline" className="ml-2">
                    {chartTracker.trip_type === "round_trip" ? "Round-trip" : "One-way"}
                  </Badge>
                </h3>
                <p className="text-xs text-[var(--muted-foreground)] mt-0.5">
                  Departure: {formatDateShort(chartTracker.departure_date)} · Target: {formatCurrency(chartTracker.target_price, chartTracker.currency)}
                </p>
              </div>
            </div>

            <LazyPriceHistoryChart
              routeId={chartTracker.route_id}
              targetPrice={Number(chartTracker.target_price)}
              currency={chartTracker.currency}
            />
          </div>
        </Dialog>
      )}

      {/* Delete Confirmation Dialog */}
      {deleteTarget && (
        <Dialog open={Boolean(deleteTarget)} onOpenChange={() => setDeleteTarget(null)}>
          <div className="space-y-4 text-center sm:text-left">
            <div className="space-y-2">
              <h3 className="text-lg font-bold text-[var(--foreground)]">Stop Tracking Route?</h3>
              <p className="text-xs sm:text-sm text-[var(--muted-foreground)] leading-relaxed">
                Are you sure you want to delete tracking for{" "}
                <strong className="text-[var(--foreground)]">
                  {deleteTarget.origin} → {deleteTarget.destination}
                </strong>{" "}
                departing on {formatDateShort(deleteTarget.departure_date)}? You will no longer receive price drop alerts for this flight.
              </p>
            </div>

            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2.5 pt-2">
              <Button
                variant="outline"
                className="w-full sm:w-auto font-semibold"
                onClick={() => setDeleteTarget(null)}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                className="w-full sm:w-auto font-bold"
                disabled={busyId === deleteTarget.id}
                onClick={handleConfirmDelete}
              >
                Confirm Deletion
              </Button>
            </div>
          </div>
        </Dialog>
      )}
    </>
  );
}
