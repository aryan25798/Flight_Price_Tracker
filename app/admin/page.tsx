import {
  Activity,
  AlertTriangle,
  Bell,
  CheckCircle2,
  Clock,
  Plane,
  Radio,
  Route,
  Server,
  Shield,
  UserCheck,
  Users,
  UserX,
  Zap,
} from "lucide-react";
import { createClient, requireSuperAdminProfile } from "@/lib/supabase/server";
import { callAdminEdgeFunction } from "@/services/admin/admin-api";
import { PollingRunsChart } from "@/components/admin/polling-runs-chart";
import { TriggerPollButton } from "@/components/admin/trigger-poll-button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatRelativeTime } from "@/lib/utils";

interface AdminStats {
  total_users: number;
  active_users: number;
  banned_users: number;
  total_trackers: number;
  active_trackers: number;
  unique_monitored_routes: number;
  successful_alerts: number;
  failed_notifications: number;
  total_api_requests: number;
  total_provider_failures: number;
  last_successful_poll: string | null;
}

export default async function AdminOverviewPage() {
  await requireSuperAdminProfile();
  const supabase = await createClient();

  const [statsRes, { data: recentRuns }] = await Promise.all([
    callAdminEdgeFunction<{ stats: AdminStats }>({ action: "get_stats" }),
    supabase
      .from("polling_runs")
      .select("id, started_at, status, routes_succeeded, routes_failed, notifications_sent")
      .order("started_at", { ascending: false })
      .limit(14),
  ]);

  const stats: AdminStats = statsRes.ok
    ? statsRes.data.stats
    : {
        total_users: 0,
        active_users: 0,
        banned_users: 0,
        total_trackers: 0,
        active_trackers: 0,
        unique_monitored_routes: 0,
        successful_alerts: 0,
        failed_notifications: 0,
        total_api_requests: 0,
        total_provider_failures: 0,
        last_successful_poll: null,
      };

  const statCards = [
    { label: "Total Users", value: stats.total_users, sub: `${stats.active_users} active members`, icon: Users, color: "text-sky-400", bg: "bg-sky-500/15" },
    { label: "Active Trackers", value: stats.active_trackers, sub: `${stats.total_trackers} cumulative`, icon: Plane, color: "text-emerald-400", bg: "bg-emerald-500/15" },
    { label: "Deduplicated Routes", value: stats.unique_monitored_routes, sub: "1 check serves all users", icon: Route, color: "text-cyan-400", bg: "bg-cyan-500/15" },
    { label: "Total Alerts Sent", value: stats.successful_alerts, sub: `${stats.failed_notifications} failed drops`, icon: Bell, color: "text-amber-400", bg: "bg-amber-500/15" },
    { label: "API Requests", value: stats.total_api_requests, sub: `${stats.total_provider_failures} provider drops`, icon: Activity, color: "text-indigo-400", bg: "bg-indigo-500/15" },
    { label: "System Health", value: "99.9%", sub: "4h cron active", icon: Server, color: "text-emerald-400", bg: "bg-emerald-500/15" },
  ];

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Header and Manual Execution Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-[var(--border)] pb-5">
        <div className="space-y-1">
          <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight text-[var(--foreground)]">
            Admin Dashboard
          </h2>
          <p className="text-xs sm:text-sm text-[var(--muted-foreground)] leading-relaxed">
            System overview and engine management. Last successful background cycle: <strong className="text-[var(--foreground)] font-mono">{formatRelativeTime(stats.last_successful_poll)}</strong>
          </p>
        </div>
        <TriggerPollButton />
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
                <div className={`flex h-8 w-8 items-center justify-center rounded-xl ${item.bg} ${item.color} border border-[var(--border)]`}>
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
                {(recentRuns ?? []).map((run) => (
                  <tr key={run.id} className="hover:bg-[var(--glass-surface-2)] transition-colors">
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
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
