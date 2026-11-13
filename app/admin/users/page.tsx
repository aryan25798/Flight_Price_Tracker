import { requireSuperAdminProfile } from "@/lib/supabase/server";
import { callAdminEdgeFunction } from "@/services/admin/admin-api";
import { UsersManager } from "@/components/admin/users-manager";
import type { Profile } from "@/types/database";

const PAGE_SIZE = 20;

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; search?: string; status?: string }>;
}) {
  const { profile } = await requireSuperAdminProfile();
  const params = await searchParams;
  const page = Math.max(1, Number(params.page ?? "1") || 1);
  const search = params.search?.trim() ?? "";
  const status =
    params.status === "active" || params.status === "banned" ? params.status : "all";

  const res = await callAdminEdgeFunction<{
    users: Profile[];
    total: number;
    page: number;
    pageSize: number;
  }>({
    action: "list_users",
    page,
    pageSize: PAGE_SIZE,
    ...(search ? { search } : {}),
    status,
  });

  const data = res.ok ? res.data : { users: [], total: 0, page, pageSize: PAGE_SIZE };

  return (
    <UsersManager
      users={data.users}
      total={data.total}
      page={page}
      pageSize={PAGE_SIZE}
      currentAdminId={profile.id}
      initialSearch={search}
      initialStatus={status}
    />
  );
}
