import { NextRequest, NextResponse } from "next/server";
import { pollAllDueRoutes, pollSingleRoute } from "@/lib/flights/poller";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function isAuthorized(req: NextRequest): boolean {
  // 1. Vercel Cron header (automatically provided by Vercel for scheduled crons)
  if (req.headers.get("x-vercel-cron")) {
    return true;
  }

  // 2. Secret-based authorization via x-cron-secret or Authorization header
  const cronSecret = process.env.CRON_SECRET;
  const headerSecret =
    req.headers.get("x-cron-secret") ||
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");

  if (cronSecret && headerSecret && headerSecret === cronSecret) {
    return true;
  }

  // 3. Query parameter secret fallback (?token=...)
  const tokenParam = req.nextUrl.searchParams.get("token") || req.nextUrl.searchParams.get("key");
  if (cronSecret && tokenParam && tokenParam === cronSecret) {
    return true;
  }

  // 4. In development mode, allow manual invocation
  if (process.env.NODE_ENV === "development") {
    return true;
  }

  return false;
}

export async function GET(req: NextRequest) {
  return handlePoll(req);
}

export async function POST(req: NextRequest) {
  return handlePoll(req);
}

async function handlePoll(req: NextRequest) {
  // If not authorized by cron headers/secret, check if caller is an authenticated super_admin
  if (!isAuthorized(req)) {
    try {
      const supabase = await createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();

      if (profile?.role !== "super_admin") {
        return NextResponse.json({ error: "Forbidden: Super Admin required" }, { status: 403 });
      }
    } catch {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const { searchParams } = req.nextUrl;
  const routeId = searchParams.get("route_id");
  const forceAll = searchParams.get("force") === "true";
  const forceAlerts =
    searchParams.get("force_alerts") === "true" ||
    searchParams.get("forceAlerts") === "true";
  const limit = Math.min(50, Math.max(1, Number(searchParams.get("limit")) || 25));

  try {
    if (routeId) {
      const singleResult = await pollSingleRoute(routeId, { forceAlerts });
      return NextResponse.json({
        ok: singleResult.ok,
        type: "single",
        result: singleResult,
        timestamp: new Date().toISOString(),
      });
    }

    const cycleResult = await pollAllDueRoutes({ limit, forceAll, forceAlerts });
    return NextResponse.json({
      ok: cycleResult.ok,
      type: "cycle",
      claimed: cycleResult.claimed,
      succeeded: cycleResult.succeeded,
      failed: cycleResult.failed,
      notificationsSent: cycleResult.notificationsSent,
      details: cycleResult.details,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : "Polling failure";
    console.error("API cron /api/cron/check-prices error:", err);
    return NextResponse.json({ ok: false, error: errorMsg }, { status: 500 });
  }
}
