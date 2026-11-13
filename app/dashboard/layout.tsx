import { getAuthenticatedProfile } from "@/lib/supabase/server";
import { AppShell } from "@/components/shared/app-shell";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { profile } = await getAuthenticatedProfile();
  return <AppShell profile={profile}>{children}</AppShell>;
}
