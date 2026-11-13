import { getAuthenticatedProfile, createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/shared/app-shell";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { profile } = await getAuthenticatedProfile();
  const supabase = await createClient();

  const { count: unreadCount } = await supabase
    .from("notification_logs")
    .select("id", { count: "exact", head: true })
    .eq("user_id", profile.id)
    .eq("is_read", false);

  return (
    <AppShell profile={profile} unreadNotificationCount={unreadCount ?? 0}>
      {children}
    </AppShell>
  );
}
