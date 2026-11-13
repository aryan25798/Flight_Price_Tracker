"use server";

import { revalidatePath } from "next/cache";
import { createClient, requireSuperAdminProfile } from "@/lib/supabase/server";
import { callAdminEdgeFunction } from "@/services/admin/admin-api";
import { sendEmail } from "@/lib/email/smtp";

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

export async function updateUserTierAction(params: {
  userId: string;
  tier: "free" | "pro" | "enterprise";
  customTrackerLimit: number | null;
  tierNotes?: string | null;
}): Promise<{ ok: boolean; error?: string }> {
  await requireSuperAdminProfile();
  const supabase = await createClient();

  const { error } = await supabase.rpc("admin_update_user_tier", {
    p_user_id: params.userId,
    p_tier: params.tier,
    p_custom_tracker_limit: params.customTrackerLimit,
    p_tier_notes: params.tierNotes ?? null,
  });

  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath("/admin/users");
  revalidatePath("/admin");
  return { ok: true };
}

export async function testSmtpConnectionAction(
  targetEmail: string,
): Promise<{ ok: boolean; message: string }> {
  await requireSuperAdminProfile();

  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
    return {
      ok: false,
      message: "SMTP is not configured. Please add SMTP_HOST, SMTP_USER, and SMTP_PASS to .env.local",
    };
  }

  const result = await sendEmail({
    to: targetEmail,
    subject: "✈️ AeroDrop 2.0 Test Email Dispatch",
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background: #060913; color: #f8fafc; padding: 32px 20px; border-radius: 16px; border: 1px solid rgba(56, 189, 248, 0.3);">
        <h2 style="color: #38bdf8; margin-top: 0;">✈️ AeroDrop 2.0 SMTP Mail Engine Verified</h2>
        <p style="color: #cbd5e1; font-size: 14px; line-height: 1.6;">
          This test message confirms that your custom SMTP server (<strong>${process.env.SMTP_HOST}</strong>) is functioning properly and sending real-time price alerts to AeroDrop members.
        </p>
        <div style="margin-top: 20px; padding: 12px 16px; background: rgba(56, 189, 248, 0.1); border-radius: 8px; border: 1px solid rgba(56, 189, 248, 0.2); font-family: monospace; font-size: 12px; color: #38bdf8;">
          Server: ${process.env.SMTP_HOST}:${process.env.SMTP_PORT || 587}<br>
          From: ${process.env.SMTP_FROM || process.env.SMTP_USER}<br>
          Timestamp: ${new Date().toISOString()}
        </div>
        <p style="color: #64748b; font-size: 11px; margin-top: 24px; margin-bottom: 0;">
          © 2026 AeroDrop 2.0 · Autonomous Flight Price Drop Tracker
        </p>
      </div>
    `,
    text: "AeroDrop 2.0 custom SMTP test email successful.",
  });

  if (!result) {
    return {
      ok: false,
      message: "SMTP delivery failed. Check your host, port, credentials, and app password.",
    };
  }

  return {
    ok: true,
    message: `Test email successfully dispatched to ${targetEmail} via custom SMTP!`,
  };
}

export async function fetchAdminOverviewData(): Promise<{
  ok: boolean;
  stats: AdminStats | null;
  recentRuns: PollingRunRow[];
}> {
  await requireSuperAdminProfile();
  const supabase = await createClient();

  const [{ data: rpcStats, error: rpcError }, { data: recentRuns }] = await Promise.all([
    supabase.rpc("get_admin_dashboard_stats"),
    supabase
      .from("polling_runs")
      .select("id, started_at, status, routes_succeeded, routes_failed, notifications_sent")
      .order("started_at", { ascending: false })
      .limit(14),
  ]);

  if (!rpcError && rpcStats) {
    return {
      ok: true,
      stats: rpcStats as unknown as AdminStats,
      recentRuns: (recentRuns ?? []) as PollingRunRow[],
    };
  }

  const edgeRes = await callAdminEdgeFunction<{ stats: AdminStats }>({ action: "get_stats" });

  return {
    ok: edgeRes.ok,
    stats: edgeRes.ok ? edgeRes.data.stats : null,
    recentRuns: (recentRuns ?? []) as PollingRunRow[],
  };
}

