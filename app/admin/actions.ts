"use server";

import { revalidatePath } from "next/cache";
import { requireSuperAdminProfile } from "@/lib/supabase/server";
import { callAdminEdgeFunction } from "@/services/admin/admin-api";

export async function adminActionDispatch(
  payload: Record<string, unknown>,
  pathsToRevalidate: string[] = ["/admin"],
) {
  await requireSuperAdminProfile();
  const res = await callAdminEdgeFunction(payload);
  if (res.ok) {
    for (const p of pathsToRevalidate) {
      revalidatePath(p);
    }
  }
  return res;
}
