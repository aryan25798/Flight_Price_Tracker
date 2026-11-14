import Link from "next/link";
import { Plus, Radio, Plane, ShieldCheck, Sparkles } from "lucide-react";
import { createClient, getAuthenticatedProfile } from "@/lib/supabase/server";
import { TrackersTable } from "@/components/dashboard/trackers-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { TrackedFlight } from "@/types/database";

const DEFAULT_PAGE_SIZE = 15;

export default async function TrackersPage({
  searchParams,
}: {
  searchParams: Promise<{
    page?: string;
    search?: string;
    status?: string;
    pageSize?: string;
  }>;
}) {
  const { user, profile } = await getAuthenticatedProfile();
  const params = await searchParams;
  const page = Math.max(1, Number(params.page ?? "1") || 1);
  const pageSize = Math.min(
    100,
    Math.max(5, Number(params.pageSize ?? String(DEFAULT_PAGE_SIZE)) || DEFAULT_PAGE_SIZE),
  );
  const search = params.search?.trim() ?? "";
  const status =
    params.status === "active" || params.status === "paused" ? params.status : "all";

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const supabase = await createClient();

  let trackersQuery = supabase
    .from("tracked_flights")
    .select(
      "id, user_id, route_id, origin, destination, departure_date, return_date, trip_type, adults, children, infants, cabin_class, currency, target_price, last_seen_price, last_notified_price, last_notified_at, is_active, created_at, updated_at, monitored_routes(last_checked_at, last_airline, last_booking_url, status)",
      { count: "exact" },
    )
    .eq("user_id", user.id);

  if (search) {
    const cleanSearch = search.toUpperCase();
    trackersQuery = trackersQuery.or(
      `origin.ilike.%${cleanSearch}%,destination.ilike.%${cleanSearch}%`,
    );
  }

  if (status === "active") {
    trackersQuery = trackersQuery.eq("is_active", true);
  } else if (status === "paused") {
    trackersQuery = trackersQuery.eq("is_active", false);
  }

  const [
    { data, count },
    { count: activeCount },
  ] = await Promise.all([
    trackersQuery.order("created_at", { ascending: false }).range(from, to),
    supabase
      .from("tracked_flights")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("is_active", true),
  ]);

  const isSuperAdmin = profile.role === "super_admin";
  const userTier = profile.tier || "free";
  const isUnlimited =
    isSuperAdmin ||
    profile.custom_tracker_limit === -1 ||
    (userTier === "enterprise" && profile.custom_tracker_limit === null);

  const effectiveLimit = isUnlimited
    ? -1
    : profile.custom_tracker_limit !== null && profile.custom_tracker_limit !== undefined
      ? profile.custom_tracker_limit
      : userTier === "pro"
        ? 25
        : 3;

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Top Header Bar with Context & Action */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-sky-500/30 bg-sky-500/10 px-3 py-0.5 text-xs font-semibold text-sky-300">
              <Radio className="h-3.5 w-3.5 text-sky-400" />
              <span>Fleet Monitoring Matrix</span>
            </span>
            <span className="text-xs text-[var(--muted-foreground)]">
              Cron: 4h Routine
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight text-[var(--foreground)]">
            My Tracked Flights
          </h2>
          <p className="text-xs sm:text-sm text-[var(--muted-foreground)] leading-relaxed max-w-2xl">
            Manage your active and paused flight alerts, compare live seller rates across 6 sites, and inspect historical fare dips.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {isUnlimited ? (
            <Badge variant="cyan" dot className="text-xs font-semibold capitalize border-cyan-500/30">
              {isSuperAdmin ? "Super Admin" : userTier} · Unlimited (∞)
            </Badge>
          ) : (
            <Badge variant="secondary" className="text-xs font-mono">
              {activeCount ?? 0} / {effectiveLimit} Trackers Used
            </Badge>
          )}

          <Link href="/dashboard">
            <Button size="sm" className="gap-1.5 font-bold shadow-md bg-sky-600 hover:bg-sky-500 text-white rounded-xl px-4 min-h-[38px] transition-all">
              <Plus className="h-4 w-4" />
              <span>Track New Route</span>
            </Button>
          </Link>
        </div>
      </div>

      <TrackersTable
        trackers={(data ?? []) as unknown as TrackedFlight[]}
        total={count ?? 0}
        page={page}
        pageSize={pageSize}
        basePath="/dashboard/trackers"
        initialSearch={search}
        initialStatus={status}
      />
    </div>
  );
}
