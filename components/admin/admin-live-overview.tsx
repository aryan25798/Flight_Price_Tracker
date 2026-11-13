"use client";

import * as React from "react";
import {
  Activity,
  AlertTriangle,
  Bell,
  CheckCircle2,
  Clock,
  Plane,
  Radio,
  RefreshCw,
  Route,
  Server,
  Shield,
  Users,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { fetchAdminOverviewData, type AdminStats, type PollingRunRow } from "@/app/admin/actions";
import { PollingRunsChart } from "@/components/admin/polling-runs-chart";
import { TriggerPollButton } from "@/components/admin/trigger-poll-button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatRelativeTime } from "@/lib/utils";

interface AdminLiveOverviewProps {
  initialStats: AdminStats;
  initialRuns: PollingRunRow[];
}

export function AdminLiveOverview({ initialStats, initialRuns }: AdminLiveOverviewProps) {
  const [stats, setStats] = React.useState<AdminStats>(initialStats);
  const [recentRuns, setRecentRuns] = React.useState<PollingRunRow[]>(initialRuns);
  const [isRealtimeConnected, setIsRealtimeConnected] = React.useState(false);
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const [lastRefreshedAt, setLastRefreshedAt] = React.useState<Date>(new Date());
  const [timeAgo, setTimeAgo] = React.useState<string>("Just now");

  const refreshTelemetry = React.useCallback(async () => {
    setIsRefreshing(true);
    try {
      const res = await fetchAdminOverviewData();
      if (res.ok && res.stats) {
        setStats(res.stats);
        setRecentRuns(res.recentRuns);
        setLastRefreshedAt(new Date());
      }
    } catch (err) {
      console.error("Telemetry refresh error:", err);
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  // Update "time ago" string every 5 seconds
  React.useEffect(() => {
    const updateLabel = () => {
      const diffSec = Math.floor((Date.now() - lastRefreshedAt.getTime()) / 1000);
      if (diffSec < 5) {
        setTimeAgo("Just now");
      } else if (diffSec < 60) {
        setTimeAgo(`${diffSec}s ago`);
      } else {
        const diffMin = Math.floor(diffSec / 60);
        setTimeAgo(`${diffMin}m ago`);
      }
    };

    updateLabel();
    const interval = setInterval(updateLabel, 5000);
    return () => clearInterval(interval);
  }, [lastRefreshedAt]);

  // Set up Supabase Realtime Channel & 15-second polling fallback
  React.useEffect(() => {
    const supabase = createClient();

    const channel = supabase
      .channel("admin-live-overview")
      .on("postgres_changes", { event: "*", schema: "public", table: "polling_runs" }, () => {
        refreshTelemetry();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, () => {
        refreshTelemetry();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "tracked_flights" }, () => {
        refreshTelemetry();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "monitored_routes" }, () => {
        refreshTelemetry();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "notification_logs" }, () => {
        refreshTelemetry();
      })
      .subscribe((status) => {
        setIsRealtimeConnected(status === "SUBSCRIBED");
      });

    // 15-second heartbeat polling fallback
    const pollInterval = setInterval(() => {
      refreshTelemetry();
    }, 15000);

    return () => {
      clearInterval(pollInterval);
      supabase.removeChannel(channel);
    };
  }, [refreshTelemetry]);

  // Calculate live system health dynamically from API requests & provider failures
  const totalReq = stats.total_api_requests ?? 0;
  const totalFail = stats.total_provider_failures ?? 0;
  const healthPercent =
    totalReq > 0
      ? Math.max(0, Math.min(100, ((totalReq - totalFail) / totalReq) * 100))
      : 100;
  const healthDisplay = `${healthPercent.toFixed(1)}%`;
  const healthSub =
    totalFail === 0
      ? "100% nominal operation"
      : `${totalFail} provider dropouts`;

  const statCards = [
    {
      label: "Total Users",
      value: stats.total_users,
      sub: `${stats.active_users} active members`,
      icon: Users,
      color: "text-sky-400",
      bg: "bg-sky-500/15",
    },
    {
      label: "Active Trackers",
      value: stats.active_trackers,
      sub: `${stats.total_trackers} cumulative`,
      icon: Plane,
      color: "text-emerald-400",
      bg: "bg-emerald-500/15",
    },
    {
      label: "Deduplicated Routes",
      value: stats.unique_monitored_routes,
      sub: "1 check serves all users",
      icon: Route,
      color: "text-cyan-400",
      bg: "bg-cyan-500/15",
    },
    {
      label: "Total Alerts Sent",
      value: stats.successful_alerts,
      sub: `${stats.failed_notifications} failed drops`,
      icon: Bell,
      color: "text-amber-400",
      bg: "bg-amber-500/15",
    },
    {
      label: "API Requests",
      value: stats.total_api_requests,
      sub: `${stats.total_provider_failures} provider drops`,
      icon: Activity,
      color: "text-indigo-400",
      bg: "bg-indigo-500/15",
    },
    {
      label: "System Health",
      value: healthDisplay,
      sub: healthSub,
      icon: Server,
      color: healthPercent >= 99 ? "text-emerald-400" : "text-amber-400",
      bg: healthPercent >= 99 ? "bg-emerald-500/15" : "bg-amber-500/15",
    },
  ];

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Header and Telemetry Connection Status */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-[var(--border)] pb-5">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight text-[var(--foreground)]">
              Admin Dashboard
            </h2>

            {/* Live Realtime Connection Indicator */}
            {isRealtimeConnected ? (
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.2)]">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <span>Realtime Active</span>
              </div>
            ) : (
              <div className="inline-flex items-center gap-2 rounded-full border border-sky-500/30 bg-sky-500/10 px-3 py-1 text-xs font-semibold text-sky-400">
                <span className="h-2 w-2 rounded-full bg-sky-400 animate-pulse" />
                <span>Polling Fallback (15s)</span>
              </div>
            )}
          </div>

          <p className="text-xs sm:text-sm text-[var(--muted-foreground)] leading-relaxed">
            System overview and engine management. Telemetry synced:{" "}
            <strong className="text-[var(--foreground)] font-mono">{timeAgo}</strong>
            {" · "}
            Last poll cycle:{" "}
            <strong className="text-[var(--foreground)] font-mono">
              {formatRelativeTime(stats.last_successful_poll)}
            </strong>
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={refreshTelemetry}
            disabled={isRefreshing}
            className="gap-2 text-xs font-semibold"
            title="Force refresh live metrics"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </Button>
          <TriggerPollButton />
        </div>
      </div>

      {/* High-density Luxury Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3.5 sm:gap-4">
        {statCards.map((item) => {
          const Icon = item.icon;
          return (
            <div
              key={item.label}
              className="glass-card-interactive rounded-2xl p-4 sm:p-5 space-y-2"
            >
              <div className="flex items-center justify-between text-[var(--muted-foreground)]">
                <span className="text-[11px] font-bold uppercase tracking-wider truncate">
                  {item.label}
                </span>
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-xl ${item.bg} ${item.color} border border-[var(--border)]`}
                >
                  <Icon className="h-4 w-4" />
                </div>
              </div>
              <div className="text-2xl sm:text-3xl font-extrabold tabular-nums text-[var(--foreground)]">
                {item.value}
              </div>
              <p className="text-[11px] text-[var(--muted-foreground)] truncate font-semibold">
                {item.sub}
              </p>
            </div>
          );
        })}
      </div>

      {/* Telemetry Chart */}
      <Card className="glass-surface-1 border-[var(--border)] shadow-xl overflow-hidden">
        <CardHeader className="border-b border-[var(--border)] glass-surface-2/40 pb-4">
          <CardTitle className="text-base sm:text-lg font-extrabold tracking-tight">
            Polling Engine Execution Performance
          </CardTitle>
          <CardDescription className="text-xs sm:text-sm">
            Comparison of route successes vs failures across recent background cron cycles and manual triggers.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4 sm:p-6">
          <PollingRunsChart runs={recentRuns} />
        </CardContent>
      </Card>

      {/* Recent Polling Runs Telemetry Table */}
      <Card className="glass-surface-1 border-[var(--border)] shadow-xl overflow-hidden">
        <CardHeader className="border-b border-[var(--border)] glass-surface-2/40 pb-4">
          <CardTitle className="text-base sm:text-lg font-extrabold tracking-tight">
            Recent Polling Cycle Executions
          </CardTitle>
          <CardDescription className="text-xs sm:text-sm">
            Observability ledger tracking automated 4-hour cron runs and manual administrator triggers.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] glass-surface-2/60 text-[10px] sm:text-xs uppercase tracking-wider text-[var(--muted-foreground)] font-bold">
                  <th className="py-3 px-4 sm:px-6">Started</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Succeeded</th>
                  <th className="py-3 px-4">Failed</th>
                  <th className="py-3 px-4 sm:px-6 text-right">Alerts Dispatched</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {recentRuns.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="py-8 text-center text-xs text-[var(--muted-foreground)]"
                    >
                      No background polling cycles recorded yet.
                    </td>
                  </tr>
                ) : (
                  recentRuns.map((run) => (
                    <tr
                      key={run.id}
                      className="hover:bg-[var(--glass-surface-2)] transition-colors"
                    >
                      <td className="py-3.5 px-4 sm:px-6 font-mono text-xs whitespace-nowrap">
                        {formatRelativeTime(run.started_at)}
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <Badge
                          variant={
                            run.status === "completed"
                              ? "success"
                              : run.status === "failed"
                                ? "destructive"
                                : "warning"
                          }
                          dot
                        >
                          {run.status}
                        </Badge>
                      </td>
                      <td className="py-3.5 px-4 font-mono font-bold text-emerald-400">
                        {run.routes_succeeded}
                      </td>
                      <td className="py-3.5 px-4 font-mono font-bold text-red-400">
                        {run.routes_failed}
                      </td>
                      <td className="py-3.5 px-4 sm:px-6 text-right font-mono font-bold">
                        {run.notifications_sent}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
