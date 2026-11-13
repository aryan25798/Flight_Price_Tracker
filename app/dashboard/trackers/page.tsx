import { createClient, getAuthenticatedProfile } from "@/lib/supabase/server";
import { TrackersTable } from "@/components/dashboard/trackers-table";
import { Badge } from "@/components/ui/badge";
import type { TrackedFlight } from "@/types/database";

const PAGE_SIZE = 15;

export default async function TrackersPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { user, profile } = await getAuthenticatedProfile();
  const params = await searchParams;
  const page = Math.max(1, Number(params.page ?? "1") || 1);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const supabase = await createClient();
  const [
    { data, count },
    { count: activeCount },
  ] = await Promise.all([
    supabase
      .from("tracked_flights")
      .select(
        "id, user_id, route_id, origin, destination, departure_date, return_date, trip_type, adults, children, infants, cabin_class, currency, target_price, last_seen_price, last_notified_price, last_notified_at, is_active, created_at, updated_at, monitored_routes(last_checked_at, last_airline, last_booking_url, status)",
        { count: "exact" },
      )
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .range(from, to),
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
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight text-[var(--foreground)]">
            My Tracked Flights
          </h2>
          <p className="text-xs sm:text-sm text-[var(--muted-foreground)] leading-relaxed">
            Manage your active and paused flight alerts, compare live seller rates across 6 sites, and inspect fare trends.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isUnlimited ? (
            <Badge variant="cyan" dot className="text-xs font-semibold capitalize border-cyan-500/30">
              {isSuperAdmin ? "Super Admin" : userTier} · Unlimited (∞)
            </Badge>
          ) : (
            <Badge variant="secondary" className="text-xs font-mono">
              {activeCount ?? 0} / {effectiveLimit} Trackers Used
            </Badge>
          )}
        </div>
      </div>

      <TrackersTable
        trackers={(data ?? []) as unknown as TrackedFlight[]}
        total={count ?? 0}
        page={page}
        pageSize={PAGE_SIZE}
        basePath="/dashboard/trackers"
      />
    </div>
  );
}
