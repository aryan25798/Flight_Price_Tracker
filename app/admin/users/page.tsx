import { createClient, requireSuperAdminProfile } from "@/lib/supabase/server";
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

  const supabase = await createClient();
  let query = supabase
    .from("profiles")
    .select(
      "id, email, role, tier, custom_tracker_limit, tier_notes, is_banned, telegram_chat_id, created_at, updated_at",
      { count: "exact" },
    )
    .order("created_at", { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

  if (search) {
    query = query.ilike("email", `%${search}%`);
  }
  if (status === "active") {
    query = query.eq("is_banned", false);
  } else if (status === "banned") {
    query = query.eq("is_banned", true);
  }

  const { data: users, count } = await query;

  return (
    <UsersManager
      users={(users ?? []) as Profile[]}
      total={count ?? 0}
      page={page}
      pageSize={PAGE_SIZE}
      currentAdminId={profile.id}
      initialSearch={search}
      initialStatus={status}
    />
  );
}
