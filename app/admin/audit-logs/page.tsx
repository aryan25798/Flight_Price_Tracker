import { requireSuperAdminProfile } from "@/lib/supabase/server";
import { callAdminEdgeFunction } from "@/services/admin/admin-api";
import { AuditLogsViewer } from "@/components/admin/audit-logs-viewer";

const PAGE_SIZE = 25;

export default async function AdminAuditLogsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; search?: string }>;
}) {
  await requireSuperAdminProfile();
  const params = await searchParams;
  const page = Math.max(1, Number(params.page ?? "1") || 1);
  const search = params.search?.trim() ?? "";

  const res = await callAdminEdgeFunction<{
    logs: Array<{
      id: string;
      admin_id: string | null;
      action: string;
      target_id: string | null;
      metadata: Record<string, unknown>;
      ip_address: string | null;
      created_at: string;
      profiles?: { email: string } | null;
    }>;
    total: number;
  }>({
    action: "list_audit_logs",
    page,
    pageSize: PAGE_SIZE,
    ...(search ? { search } : {}),
  });

  const data = res.ok ? res.data : { logs: [], total: 0 };

  return (
    <AuditLogsViewer
      logs={data.logs}
      total={data.total}
      page={page}
      pageSize={PAGE_SIZE}
      initialSearch={search}
    />
  );
}
