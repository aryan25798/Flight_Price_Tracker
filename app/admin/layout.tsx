import { requireSuperAdminProfile } from "@/lib/supabase/server";
import { AdminShell } from "@/components/admin/admin-shell";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { profile } = await requireSuperAdminProfile();
  return <AdminShell profile={profile}>{children}</AdminShell>;
}
