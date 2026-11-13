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
import { ArrowDown, ArrowUp, CheckCircle, Clock, Plane, TrendingDown } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
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

      {/* Chart Canvas */}
      <div className="rounded-2xl border border-[var(--border)] glass-surface-1 p-3.5 sm:p-5 shadow-xl">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-bold uppercase tracking-wider text-[var(--muted-foreground)]">
            30-Day Trend Overview
          </span>
          <span className="text-[11px] text-sky-400 font-semibold font-mono">
            {points.length} checks logged
          </span>
        </div>
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
    </div>
  );
}
