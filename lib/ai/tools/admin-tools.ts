import { tool } from "ai";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Profile } from "@/types/database";

export interface AdminToolContext {
  user: { id: string; email?: string };
  profile: Profile;
  supabase: SupabaseClient;
}

export function buildAdminTools(ctx: AdminToolContext) {
  if (ctx.profile.role !== "super_admin") {
    throw new Error("Unauthorized: Admin tools require super_admin privileges.");
  }

  return {
    get_admin_overview: tool({
      description: "Retrieve comprehensive operational statistics across all platform users, monitored routes, and alert deliveries.",
      inputSchema: z.object({}),
      execute: async () => {
        const { data: stats, error } = await ctx.supabase.rpc("get_admin_dashboard_stats");
        if (error) return { error: "Failed to fetch admin dashboard statistics." };
        return { stats };
      },
    }),

    get_system_health: tool({
      description: "Inspect live system telemetry, API request volumes, provider dropout rates, and overall uptime health percentage.",
      inputSchema: z.object({}),
      execute: async () => {
        const { data: stats, error } = await ctx.supabase.rpc("get_admin_dashboard_stats");
        if (error || !stats) return { error: "Failed to evaluate system health." };

        const totalReq = (stats.total_api_requests as number) || 0;
        const totalFail = (stats.total_provider_failures as number) || 0;
        const healthPercent = totalReq > 0
          ? Math.max(0, Math.min(100, ((totalReq - totalFail) / totalReq) * 100))
          : 100;

        return {
          healthPercentage: `${healthPercent.toFixed(1)}%`,
          status: healthPercent >= 99 ? "HEALTHY" : "DEGRADED",
          totalApiRequests: totalReq,
          providerDropouts: totalFail,
          lastSuccessfulPoll: stats.last_successful_poll || "No runs completed yet",
          uniqueMonitoredRoutes: stats.unique_monitored_routes,
          activeTrackers: stats.active_trackers,
        };
      },
    }),

    get_polling_runs: tool({
      description: "Inspect recent automated 4-hour background cron executions and manual administrator price-check triggers.",
      inputSchema: z.object({
        limit: z.number().int().min(1).max(20).default(5),
      }),
      execute: async ({ limit }: { limit: number }) => {
        const { data: runs, error } = await ctx.supabase
          .from("polling_runs")
          .select("id, started_at, finished_at, status, routes_succeeded, routes_failed, notifications_sent")
          .order("started_at", { ascending: false })
          .limit(limit);

        if (error) return { error: "Failed to fetch polling run ledger." };

        return {
          totalRunsRetrieved: runs?.length ?? 0,
          runs: (runs ?? []).map((r) => ({
            id: r.id.slice(0, 8),
            startedAt: r.started_at,
            status: r.status,
            routesSucceeded: r.routes_succeeded,
            routesFailed: r.routes_failed,
            alertsDispatched: r.notifications_sent,
          })),
        };
      },
    }),

    search_users_operational: tool({
      description: "Search user directory by email substring to inspect tier, status, and active quota limits.",
      inputSchema: z.object({
        emailQuery: z.string().trim().max(100).describe("Email search term or domain"),
      }),
      execute: async ({ emailQuery }: { emailQuery: string }) => {
        const { data: users, error } = await ctx.supabase
          .from("profiles")
          .select("id, email, role, tier, custom_tracker_limit, is_banned, created_at")
          .ilike("email", `%${emailQuery}%`)
          .limit(10);

        if (error) return { error: "Failed to query user accounts." };

        return {
          count: users?.length ?? 0,
          users: (users ?? []).map((u) => ({
            id: u.id.slice(0, 8),
            email: u.email,
            role: u.role,
            tier: u.tier,
            isBanned: u.is_banned,
            quotaLimit: u.custom_tracker_limit === -1
              ? "Unlimited"
              : u.custom_tracker_limit ?? (u.tier === "pro" ? 25 : 3),
            joined: u.created_at.slice(0, 10),
          })),
        };
      },
    }),

    trigger_system_poll: tool({
      description: "Propose manually initiating an immediate background price check across all active routes. Requires admin confirmation.",
      inputSchema: z.object({}),
      execute: async () => {
        return {
          type: "action_proposal",
          action: "trigger_poll",
          requiresUserConfirmation: true,
          details: {
            actor: ctx.user.email,
            actionName: "Immediate Full-Fleet Price Radar Poll",
            impact: "Will query live external flight providers for all active routes and dispatch alerts.",
          },
          confirmationMessage: "Confirm triggering an immediate manual polling cycle across all active monitored routes?",
        };
      },
    }),
  };
}
