import { createClient, requireSuperAdminProfile } from "@/lib/supabase/server";
import { callAdminEdgeFunction } from "@/services/admin/admin-api";
import { AdminLiveOverview } from "@/components/admin/admin-live-overview";
import type { AdminStats, PollingRunRow } from "@/app/admin/actions";

export default async function AdminOverviewPage() {
  await requireSuperAdminProfile();
  const supabase = await createClient();

  // 1. Direct authenticated RPC query (fastest, direct DB evaluation)
  // 2. Fallback to Edge function if needed
  const [{ data: rpcStats, error: rpcError }, { data: recentRuns }] = await Promise.all([
    supabase.rpc("get_admin_dashboard_stats"),
    supabase
      .from("polling_runs")
      .select("id, started_at, status, routes_succeeded, routes_failed, notifications_sent")
      .order("started_at", { ascending: false })
      .limit(14),
  ]);

  let stats: AdminStats;

  if (!rpcError && rpcStats) {
    stats = rpcStats as unknown as AdminStats;
  } else {
    const edgeRes = await callAdminEdgeFunction<{ stats: AdminStats }>({ action: "get_stats" });
    stats = edgeRes.ok
      ? edgeRes.data.stats
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
  }

  return (
    <AdminLiveOverview
      initialStats={stats}
      initialRuns={(recentRuns ?? []) as PollingRunRow[]}
    />
  );
}
