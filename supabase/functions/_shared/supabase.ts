import { createClient, type SupabaseClient, type User } from "https://esm.sh/@supabase/supabase-js@2.49.1";

export interface AuthenticatedContext {
  user: User;
  profile: {
    id: string;
    email: string;
    role: "user" | "super_admin";
    is_banned: boolean;
    telegram_chat_id: string | null;
  };
  supabaseAdmin: SupabaseClient;
}

export function createServiceClient(): SupabaseClient {
  const url = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!url || !serviceRoleKey) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }

  return createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export async function requireAuthenticatedUser(
  req: Request,
): Promise<{ ok: true; ctx: AuthenticatedContext } | { ok: false; status: number; message: string }> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return { ok: false, status: 401, message: "Missing bearer token" };
  }

  const jwt = authHeader.slice(7).trim();
  if (!jwt) {
    return { ok: false, status: 401, message: "Empty bearer token" };
  }

  const supabaseAdmin = createServiceClient();
  const { data: userData, error: authError } = await supabaseAdmin.auth.getUser(jwt);

  if (authError || !userData.user) {
    return { ok: false, status: 401, message: "Invalid or expired session" };
  }

  const { data: profile, error: profileError } = await supabaseAdmin
    .from("profiles")
    .select("id, email, role, is_banned, telegram_chat_id")
    .eq("id", userData.user.id)
    .single();

  if (profileError || !profile) {
    return { ok: false, status: 403, message: "User profile not found" };
  }

  if (profile.is_banned) {
    return { ok: false, status: 403, message: "Account is suspended" };
  }

  return {
    ok: true,
    ctx: {
      user: userData.user,
      profile: profile as AuthenticatedContext["profile"],
      supabaseAdmin,
    },
  };
}

export async function requireSuperAdmin(
  req: Request,
): Promise<{ ok: true; ctx: AuthenticatedContext } | { ok: false; status: number; message: string }> {
  const authResult = await requireAuthenticatedUser(req);
  if (!authResult.ok) return authResult;

  if (authResult.ctx.profile.role !== "super_admin") {
    return { ok: false, status: 403, message: "Forbidden: super_admin access required" };
  }

  return authResult;
}
