"use server";

import { revalidatePath } from "next/cache";
import { createClient, requireSuperAdminProfile } from "@/lib/supabase/server";
import { callAdminEdgeFunction } from "@/services/admin/admin-api";

export interface AdminStats {
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

export interface PollingRunRow {
  id: string;
  started_at: string;
  status: string;
  routes_succeeded: number;
  routes_failed: number;
  notifications_sent: number;
}

export async function adminActionDispatch(
  payload: Record<string, unknown>,
  pathsToRevalidate: string[] = ["/admin"],
) {
  await requireSuperAdminProfile();
  const res = await callAdminEdgeFunction(payload);
  if (res.ok) {
    for (const p of pathsToRevalidate) {
      revalidatePath(p);
    }
  }
  return res;
}

export async function fetchAdminOverviewData(): Promise<{
  ok: boolean;
  stats: AdminStats | null;
  recentRuns: PollingRunRow[];
}> {
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

  return {
    ok: statsRes.ok,
    stats: statsRes.ok ? statsRes.data.stats : null,
    recentRuns: (recentRuns ?? []) as PollingRunRow[],
  };
}

