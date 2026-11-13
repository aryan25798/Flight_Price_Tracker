import { createClient, requireSuperAdminProfile } from "@/lib/supabase/server";
import { SettingsForm } from "@/components/admin/settings-form";

export default async function AdminSettingsPage() {
  await requireSuperAdminProfile();
  const supabase = await createClient();

  const { data } = await supabase.from("system_settings").select("key, value");
  const map = new Map<string, unknown>();
  for (const row of data ?? []) {
    map.set(row.key, row.value);
  }

  const initial = {
    polling_interval_minutes: Number(map.get("polling_interval_minutes") ?? 240),
    max_api_calls_per_cycle: Number(map.get("max_api_calls_per_cycle") ?? 50),
    max_concurrent_requests: Number(map.get("max_concurrent_requests") ?? 3),
    notification_cooldown_hours: Number(map.get("notification_cooldown_hours") ?? 12),
    price_drop_threshold_percent: Number(map.get("price_drop_threshold_percent") ?? 5),
    price_history_retention_days: Number(map.get("price_history_retention_days") ?? 90),
    max_trackers_per_user: Number(map.get("max_trackers_per_user") ?? 10),
    max_route_retries: Number(map.get("max_route_retries") ?? 5),
    maintenance_mode: map.get("maintenance_mode") === true,
  };

  return <SettingsForm initial={initial} />;
}
