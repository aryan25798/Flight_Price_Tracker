import { requireSuperAdminProfile } from "@/lib/supabase/server";
import { callAdminEdgeFunction } from "@/services/admin/admin-api";
import { GlobalTrackersManager } from "@/components/admin/global-trackers-manager";
import type { TrackedFlight } from "@/types/database";

const PAGE_SIZE = 20;

export default async function AdminTrackersPage({
  searchParams,
}: {
  searchParams: Promise<{
    page?: string;
    email?: string;
    origin?: string;
    destination?: string;
    status?: string;
    departureDate?: string;
  }>;
}) {
  await requireSuperAdminProfile();
  const params = await searchParams;
  const page = Math.max(1, Number(params.page ?? "1") || 1);
  const email = params.email?.trim() ?? "";
  const origin = params.origin?.trim().toUpperCase() ?? "";
  const destination = params.destination?.trim().toUpperCase() ?? "";
  const status =
    params.status === "active" || params.status === "paused" ? params.status : "all";
  const departureDate = params.departureDate?.trim() ?? "";

  const res = await callAdminEdgeFunction<{
    trackers: (TrackedFlight & { profiles?: { email: string } | null })[];
    total: number;
  }>({
    action: "list_trackers",
    page,
    pageSize: PAGE_SIZE,
    ...(email ? { email } : {}),
    ...(origin ? { origin } : {}),
    ...(destination ? { destination } : {}),
    ...(departureDate ? { departureDate } : {}),
    status,
  });

  const data = res.ok ? res.data : { trackers: [], total: 0 };

  return (
    <GlobalTrackersManager
      trackers={data.trackers}
      total={data.total}
      page={page}
      pageSize={PAGE_SIZE}
      initialFilters={{ email, origin, destination, status, departureDate }}
    />
  );
}
