import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { Profile } from "@/types/database";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: CookieOptions }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Ignored when called from a Server Component where cookies cannot be mutated
          }
        },
      },
    },
  );
}

export async function getAuthenticatedProfile(): Promise<{
  user: { id: string; email?: string };
  profile: Profile;
}> {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect("/login");
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, email, role, is_banned, telegram_chat_id, created_at, updated_at")
    .eq("id", user.id)
    .single();

  if (profileError || !profile) {
    redirect("/login");
  }

  if (profile.is_banned) {
    redirect("/login?error=account_suspended");
  }

  return {
    user: { id: user.id, email: user.email },
    profile: profile as Profile,
  };
}

export async function requireSuperAdminProfile(): Promise<{
  user: { id: string; email?: string };
  profile: Profile;
}> {
  const result = await getAuthenticatedProfile();
  if (result.profile.role !== "super_admin") {
    redirect("/dashboard?error=forbidden");
  }
  return result;
}
