import { NextResponse } from "next/server";
import { type EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const rawNext = searchParams.get("next");
  const urlError = searchParams.get("error_description") || searchParams.get("error");

  // Determine the default target based on verification type
  const isRecovery = type === "recovery" || (rawNext && rawNext.includes("reset-password"));
  const defaultNext = isRecovery ? "/auth/reset-password" : "/dashboard";

  // Prevent open-redirect attacks by ensuring relative internal paths
  const safeNext =
    rawNext && rawNext.startsWith("/") && !rawNext.startsWith("//")
      ? rawNext
      : defaultNext;

  // Case 1: Supabase provided an error parameter in the URL
  if (urlError) {
    const errorTarget = isRecovery ? "/auth/reset-password" : "/login";
    return NextResponse.redirect(
      `${origin}${errorTarget}?error=${encodeURIComponent(urlError)}`,
    );
  }

  const supabase = await createClient();

  // Case 2: Verification using token_hash and type (Standard Supabase OTP / Email Confirmation / Password Reset)
  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type,
    });

    if (!error) {
      const destination = type === "recovery" ? "/auth/reset-password" : safeNext;
      return NextResponse.redirect(`${origin}${destination}`);
    }

    // If OTP verification failed and it was a recovery attempt, keep user on reset-password page
    if (type === "recovery") {
      return NextResponse.redirect(
        `${origin}/auth/reset-password?error=${encodeURIComponent(error.message)}`,
      );
    }
  }

  // Case 3: Verification using PKCE authorization code
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const destination = isRecovery ? "/auth/reset-password" : safeNext;
      return NextResponse.redirect(`${origin}${destination}`);
    }

    // In case of cross-browser PKCE cookie mismatch during password recovery,
    // forward to reset-password with code so browser client can attempt resolution
    if (isRecovery) {
      return NextResponse.redirect(
        `${origin}/auth/reset-password?code=${encodeURIComponent(code)}`,
      );
    }
  }

  // Case 4: No code or token_hash, but requested recovery (e.g. hash fragment preserved by browser)
  if (isRecovery) {
    return NextResponse.redirect(`${origin}/auth/reset-password`);
  }

  // Fallback: If verification failed or params missing, redirect to login with original destination
  const loginUrl = new URL(`${origin}/login`);
  loginUrl.searchParams.set("error", "auth_callback_failed");
  if (safeNext && safeNext !== "/dashboard") {
    loginUrl.searchParams.set("next", safeNext);
  }

  return NextResponse.redirect(loginUrl.toString());
}
