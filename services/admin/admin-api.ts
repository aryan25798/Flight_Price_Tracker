import { createClient } from "@/lib/supabase/server";

export async function callAdminEdgeFunction<T = Record<string, unknown>>(
  payload: Record<string, unknown>,
): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    return { ok: false, error: "Authentication session missing" };
  }

  const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!baseUrl) {
    return { ok: false, error: "Supabase URL is not configured" };
  }

  try {
    const res = await fetch(`${baseUrl}/functions/v1/admin-actions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify(payload),
      cache: "no-store",
    });

    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { ok: false, error: json.error || `Request failed (${res.status})` };
    }

    return { ok: true, data: json as T };
  } catch {
    return { ok: false, error: "Failed to reach admin backend" };
  }
}
