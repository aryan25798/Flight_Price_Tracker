import { createClient, getAuthenticatedProfile } from "@/lib/supabase/server";
import { TrackersTable } from "@/components/dashboard/trackers-table";
import type { TrackedFlight } from "@/types/database";

const PAGE_SIZE = 15;

export default async function TrackersPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { user } = await getAuthenticatedProfile();
  const params = await searchParams;
  const page = Math.max(1, Number(params.page ?? "1") || 1);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const supabase = await createClient();
  const { data, count } = await supabase
    .from("tracked_flights")
    .select(
      "id, user_id, route_id, origin, destination, departure_date, return_date, trip_type, adults, children, infants, cabin_class, currency, target_price, last_seen_price, last_notified_price, last_notified_at, is_active, created_at, updated_at, monitored_routes(last_checked_at, last_airline, last_booking_url, status)",
      { count: "exact" },
    )
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .range(from, to);

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight text-[var(--foreground)]">
          My Tracked Flights
        </h2>
        <p className="text-xs sm:text-sm text-[var(--muted-foreground)] leading-relaxed">
          Manage your active and paused flight alerts, compare live seller rates across 6 sites, and inspect fare trends.
        </p>
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
