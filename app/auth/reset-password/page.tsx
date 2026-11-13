"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertCircle, ArrowLeft, CheckCircle2, Key, Loader2, Lock, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [password, setPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [checkingSession, setCheckingSession] = React.useState(true);
  const [hasSession, setHasSession] = React.useState(false);
  const [sessionError, setSessionError] = React.useState<string | null>(null);

  const urlError = searchParams.get("error");
  const urlCode = searchParams.get("code");
  const rawNext = searchParams.get("next") || "/dashboard";
  const safeNext = rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/dashboard";

  React.useEffect(() => {
    if (urlError) {
      setSessionError(decodeURIComponent(urlError));
      toast.error(decodeURIComponent(urlError));
    }
  }, [urlError]);

  React.useEffect(() => {
    const supabase = createClient();

    async function initSession() {
      // If code was forwarded from callback or email link, exchange it client-side
      if (urlCode) {
        try {
          const { error } = await supabase.auth.exchangeCodeForSession(urlCode);
          if (!error) {
            setHasSession(true);
            setCheckingSession(false);
            return;
          }
        } catch {
          // Ignore and check existing session
        }
      }

      // Check if active session or recovery session exists
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (session) {
        setHasSession(true);
      } else {
        // Check if hash fragment contains recovery tokens
        if (typeof window !== "undefined" && window.location.hash.includes("type=recovery")) {
          setHasSession(true);
        }
      }
      setCheckingSession(false);
    }

    initSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") {
        setHasSession(true);
        setSessionError(null);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [urlCode]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    if (password !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    setLoading(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        toast.error(error.message);
        setSessionError(error.message);
        return;
      }

      toast.success("Password updated successfully! Redirecting...");
      router.push(safeNext);
      router.refresh();
    } catch {
      toast.error("Failed to update password");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 ambient-night-mesh selection:bg-sky-500/25">
      <Card className="w-full max-w-[420px] glass-surface-1 border-[var(--border)] shadow-2xl backdrop-blur-2xl">
        <CardHeader className="space-y-1.5 pb-4 text-center sm:text-left">
          <div className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-sky-500/15 text-sky-400 mb-1 mx-auto sm:mx-0 border border-sky-500/30 shadow-[0_0_12px_rgba(56,189,248,0.2)]">
            <Lock className="h-4 w-4" />
          </div>
          <CardTitle className="text-xl sm:text-2xl font-bold tracking-tight">
            Create New Password
          </CardTitle>
          <CardDescription className="text-xs sm:text-sm">
            Choose a secure password of at least 8 characters for your account.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {sessionError && !hasSession ? (
            <div className="space-y-4">
              <div className="flex items-start gap-3 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3.5 text-xs text-rose-300">
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-400 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-semibold text-rose-200">Reset link expired or invalid</p>
                  <p className="text-[11px] text-rose-300/80 leading-relaxed">
                    The password recovery link may have already been used or has expired. Please request a fresh recovery email.
                  </p>
                </div>
              </div>
              <Link href="/forgot-password" className="block w-full">
                <Button variant="outline" className="w-full gap-2 font-semibold text-xs min-h-[40px]">
                  <ArrowLeft className="h-3.5 w-3.5" />
                  <span>Request New Reset Link</span>
                </Button>
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label
                  htmlFor="new-password"
                  className="text-xs font-semibold uppercase tracking-wider text-[var(--muted-foreground)]"
                >
                  New Password
                </label>
                <div className="relative">
                  <Key className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--muted-foreground)]" />
                  <Input
                    id="new-password"
                    type="password"
                    autoComplete="new-password"
                    placeholder="At least 8 characters"
                    className="pl-10 font-mono tracking-widest text-sm"
                    minLength={8}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="confirm-password"
                  className="text-xs font-semibold uppercase tracking-wider text-[var(--muted-foreground)]"
                >
                  Confirm Password
                </label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--muted-foreground)]" />
                  <Input
                    id="confirm-password"
                    type="password"
                    autoComplete="new-password"
                    placeholder="Confirm matching password"
                    className="pl-10 font-mono tracking-widest text-sm"
                    minLength={8}
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                  />
                </div>
              </div>

              <Button
                type="submit"
                className="w-full min-h-[46px] font-bold text-sm shadow-md"
                disabled={loading || checkingSession}
              >
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                Set New Password &amp; Continue
              </Button>

              <div className="text-center pt-1">
                <Link
                  href="/login"
                  className="text-xs text-[var(--muted-foreground)] hover:text-sky-400 transition-colors"
                >
                  Return to Sign In
                </Link>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <React.Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center ambient-night-mesh">
          <Loader2 className="h-8 w-8 text-sky-400 animate-spin" />
        </div>
      }
    >
      <ResetPasswordForm />
    </React.Suspense>
  );
}
