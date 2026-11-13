import { createClient, getAuthenticatedProfile } from "@/lib/supabase/server";
import { NotificationCenter } from "@/components/notifications/notification-center";
import type { NotificationLog } from "@/types/database";

const PAGE_SIZE = 10;

export default async function NotificationsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; filter?: string }>;
}) {
  const { user } = await getAuthenticatedProfile();
  const params = await searchParams;
  const page = Math.max(1, Number(params.page ?? "1") || 1);
  const filter = (params.filter as "all" | "unread" | "price_drop") || "all";

  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const supabase = await createClient();

  // 1. Base counts for header badges
  const [
    { count: totalCount },
    { count: unreadCount },
    { count: priceDropCount },
  ] = await Promise.all([
    supabase
      .from("notification_logs")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id),
    supabase
      .from("notification_logs")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("is_read", false),
    supabase
      .from("notification_logs")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("notification_type", "price_drop"),
  ]);

  // 2. Filtered paginated query for notifications
  let query = supabase
    .from("notification_logs")
    .select(
      `
      id,
      user_id,
      tracker_id,
      route_id,
      notification_type,
      previous_price,
      current_price,
      currency,
      delivery_status,
      sent_at,
      error_message,
      is_read,
      read_at,
      created_at,
      tracked_flights (
        origin,
        destination,
        departure_date,
        target_price,
        currency
      ),
      monitored_routes (
        origin,
        destination,
        last_airline,
        last_booking_url
      )
    `,
      { count: "exact" },
    )
    .eq("user_id", user.id);

  if (filter === "unread") {
    query = query.eq("is_read", false);
  } else if (filter === "price_drop") {
    query = query.eq("notification_type", "price_drop");
  }

  const { data: notificationsData, count: filteredCount } = await query
    .order("created_at", { ascending: false })
    .range(from, to);

  const notifications = (notificationsData ?? []) as unknown as NotificationLog[];

  return (
    <NotificationCenter
      notifications={notifications}
      total={filteredCount ?? totalCount ?? 0}
      page={page}
      pageSize={PAGE_SIZE}
      unreadCount={unreadCount ?? 0}
      priceDropCount={priceDropCount ?? 0}
      currentFilter={filter}
    />
  );
}
