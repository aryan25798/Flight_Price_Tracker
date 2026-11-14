"use client";

import * as React from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ArrowDown, ArrowUp, CheckCircle, Clock, ExternalLink, LineChart, List, Plane, TrendingDown } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency, formatDateShort } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PaginationBar } from "@/components/ui/pagination-bar";
import type { PriceHistoryPoint } from "@/types/database";

interface PriceHistoryChartProps {
  routeId: string;
  currency: string;
  targetPrice: number;
}

export function PriceHistoryChart({
  routeId,
  currency,
  targetPrice,
}: PriceHistoryChartProps) {
  const [points, setPoints] = React.useState<PriceHistoryPoint[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [viewMode, setViewMode] = React.useState<"chart" | "table">("chart");
  const [tablePage, setTablePage] = React.useState(1);
  const tablePageSize = 8;

  React.useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);

    const supabase = createClient();
    supabase
      .from("price_history")
      .select("id, route_id, price, currency, airline, booking_url, provider, checked_at")
      .eq("route_id", routeId)
      .order("checked_at", { ascending: true })
      .limit(120)
      .then(({ data, error: queryErr }) => {
        if (!active) return;
        if (queryErr) {
          setError("Unable to load historical price data.");
        } else {
          setPoints((data ?? []) as PriceHistoryPoint[]);
        }
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [routeId]);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Skeleton className="h-20 rounded-2xl" />
          <Skeleton className="h-20 rounded-2xl" />
          <Skeleton className="h-20 rounded-2xl" />
        </div>
        <Skeleton className="h-72 w-full rounded-2xl" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400">
        {error}
      </div>
    );
  }

  if (points.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-[var(--border)] p-10 text-center space-y-2.5 glass-surface-2">
        <Clock className="mx-auto h-8 w-8 text-[var(--muted-foreground)] opacity-60" />
        <h4 className="text-sm font-bold text-[var(--foreground)]">Awaiting initial price observation</h4>
        <p className="mx-auto max-w-sm text-xs text-[var(--muted-foreground)] leading-relaxed">
          No historical price data recorded for this route yet. The scheduled 4-hour background cycle will populate this chart.
        </p>
      </div>
    );
  }

  const prices = points.map((p) => Number(p.price));
  const lowest = Math.min(...prices);
  const highest = Math.max(...prices);
  const latest = prices[prices.length - 1];
  const delta = latest - targetPrice;
  const isMet = latest <= targetPrice;

  const chartData = points.map((p) => ({
    time: new Date(p.checked_at).toLocaleString("en-GB", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }),
    price: Number(p.price),
    airline: p.airline ?? "Standard Carrier",
  }));

  return (
    <div className="space-y-4">
      {/* KPI Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="rounded-2xl border border-[var(--border)] glass-surface-2 p-3.5 space-y-1 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted-foreground)]">
              Lowest Recorded
            </span>
            <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-400">
              <TrendingDown className="h-3.5 w-3.5" />
            </div>
          </div>
          <p className="font-mono text-lg font-black tabular-nums text-emerald-400">
            {formatCurrency(lowest, currency)}
          </p>
        </div>

        <div className="rounded-2xl border border-[var(--border)] glass-surface-2 p-3.5 space-y-1 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted-foreground)]">
              Latest Observed
            </span>
            <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-sky-500/15 text-sky-400">
              <Plane className="h-3.5 w-3.5" />
            </div>
          </div>
          <p className="font-mono text-lg font-black tabular-nums text-[var(--foreground)]">
            {formatCurrency(latest, currency)}
          </p>
        </div>

        <div className="rounded-2xl border border-[var(--border)] glass-surface-2 p-3.5 space-y-1 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted-foreground)]">
              Target Threshold
            </span>
            <span className="font-mono text-xs font-bold text-[var(--muted-foreground)]">
              {formatCurrency(targetPrice, currency)}
            </span>
          </div>
          <div className="flex items-center gap-1.5 pt-0.5">
            {isMet ? (
              <Badge variant="success" dot className="text-xs">
                Target Met ({formatCurrency(Math.abs(delta), currency)} under)
              </Badge>
            ) : (
              <Badge variant="warning" className="text-xs">
                {formatCurrency(delta, currency)} above target
              </Badge>
            )}
          </div>
        </div>
      </div>

      {/* View Toggle Tabs */}
      <div className="flex items-center justify-between border-b border-[var(--border)] pb-2.5">
        <div className="flex items-center gap-1.5 p-0.5 rounded-xl border border-[var(--border)] bg-[var(--card)] text-xs">
          <button
            type="button"
            onClick={() => setViewMode("chart")}
            className={`flex items-center gap-1 px-3 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
              viewMode === "chart"
                ? "bg-sky-500/20 text-sky-300 font-bold shadow-2xs"
                : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
            }`}
          >
            <LineChart className="h-3.5 w-3.5" />
            <span>Visual Trend</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode("table")}
            className={`flex items-center gap-1 px-3 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
              viewMode === "table"
                ? "bg-sky-500/20 text-sky-300 font-bold shadow-2xs"
                : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
            }`}
          >
            <List className="h-3.5 w-3.5" />
            <span>Fare Ledger ({points.length})</span>
          </button>
        </div>

        <span className="text-[11px] text-sky-400 font-mono font-semibold">
          {points.length} checks logged
        </span>
      </div>

      {viewMode === "chart" ? (
        /* Chart Canvas */
        <div className="rounded-2xl border border-[var(--border)] glass-surface-1 p-3.5 sm:p-5 shadow-xl">
          <div className="h-64 sm:h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="fareGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#38BDF8" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#38BDF8" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis
                  dataKey="time"
                  tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => formatCurrency(v, currency)}
                  width={70}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "rgba(10, 16, 30, 0.94)",
                    backdropFilter: "blur(20px)",
                    border: "1px solid rgba(255, 255, 255, 0.15)",
                    borderRadius: "1rem",
                    boxShadow: "0 20px 40px rgba(0, 0, 0, 0.6)",
                    fontSize: "0.75rem",
                    color: "#F8FAFC",
                    fontWeight: 600,
                  }}
                  formatter={(value: any, name: any, item: any) => [
                    `${formatCurrency(Number(value), currency)} (${item.payload.airline})`,
                    "Fare",
                  ]}
                />
                <ReferenceLine
                  y={targetPrice}
                  stroke="#10B981"
                  strokeDasharray="4 4"
                  strokeWidth={1.5}
                  label={{
                    value: `Target: ${formatCurrency(targetPrice, currency)}`,
                    position: "insideTopRight",
                    fill: "#10B981",
                    fontSize: 10,
                    fontWeight: 700,
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="price"
                  stroke="#38BDF8"
                  strokeWidth={3}
                  fillOpacity={1}
                  fill="url(#fareGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      ) : (
        /* Paginated Fare Ledger */
        <div className="rounded-2xl border border-[var(--border)] glass-surface-1 shadow-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[var(--border)] glass-surface-2/60 text-[10px] uppercase tracking-wider text-[var(--muted-foreground)] font-bold">
                  <th className="py-2.5 px-4">Recorded At</th>
                  <th className="py-2.5 px-4">Airline</th>
                  <th className="py-2.5 px-4">Observed Fare</th>
                  <th className="py-2.5 px-4">Target Variance</th>
                  <th className="py-2.5 px-4 text-right">Direct Link</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {[...points]
                  .reverse()
                  .slice((tablePage - 1) * tablePageSize, tablePage * tablePageSize)
                  .map((pt) => {
                    const priceNum = Number(pt.price);
                    const diff = priceNum - targetPrice;
                    const isBelow = diff <= 0;
                    return (
                      <tr key={pt.id} className="hover:bg-[var(--glass-surface-2)] transition-colors">
                        <td className="py-2.5 px-4 font-mono text-[11px] text-[var(--muted-foreground)] whitespace-nowrap">
                          {new Date(pt.checked_at).toLocaleString("en-GB", {
                            day: "2-digit",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </td>
                        <td className="py-2.5 px-4 font-semibold text-[var(--foreground)] whitespace-nowrap">
                          {pt.airline || "Unknown Airline"}
                        </td>
                        <td className="py-2.5 px-4 font-mono font-bold text-[var(--foreground)] whitespace-nowrap">
                          {formatCurrency(priceNum, pt.currency || currency)}
                        </td>
                        <td className="py-2.5 px-4 whitespace-nowrap">
                          {isBelow ? (
                            <span className="text-emerald-400 font-bold font-mono">
                              ↓ {formatCurrency(Math.abs(diff), pt.currency || currency)} below target
                            </span>
                          ) : (
                            <span className="text-amber-400 font-medium font-mono">
                              +{formatCurrency(diff, pt.currency || currency)}
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-4 text-right whitespace-nowrap">
                          {pt.booking_url ? (
                            <a
                              href={pt.booking_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-[11px] font-bold text-sky-400 hover:text-sky-300 hover:underline"
                            >
                              <span>View Fare</span>
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          ) : (
                            <span className="text-[var(--muted-foreground)]">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>

          <div className="p-3">
            <PaginationBar
              page={tablePage}
              pageSize={tablePageSize}
              total={points.length}
              onPageChange={(p) => setTablePage(p)}
              itemLabel="check points"
            />
          </div>
        </div>
      )}
    </div>
  );
}
