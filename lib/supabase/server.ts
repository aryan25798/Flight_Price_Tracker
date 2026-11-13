import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
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

// React.cache deduplicates getAuthenticatedProfile() within the same request lifecycle.
// This prevents layout.tsx and page.tsx from executing duplicate Supabase network roundtrips.
export const getAuthenticatedProfile = cache(
  async (): Promise<{
    user: { id: string; email?: string };
    profile: Profile;
  }> => {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      let loginRedirect = "/login";
      try {
        const headerList = await headers();
        const pathname = headerList.get("x-pathname");
        if (
          pathname &&
          pathname !== "/dashboard" &&
          pathname !== "/login" &&
          pathname.startsWith("/") &&
          !pathname.startsWith("//")
        ) {
          loginRedirect = `/login?next=${encodeURIComponent(pathname)}`;
        }
      } catch {
        // Fallback to default /login
      }
      redirect(loginRedirect);
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, email, role, tier, custom_tracker_limit, tier_notes, is_banned, telegram_chat_id, created_at, updated_at")
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
  },
);

export const requireSuperAdminProfile = cache(
  async (): Promise<{
    user: { id: string; email?: string };
    profile: Profile;
  }> => {
    const result = await getAuthenticatedProfile();
    if (result.profile.role !== "super_admin") {
      redirect("/dashboard?error=forbidden");
    }
    return result;
  },
);
