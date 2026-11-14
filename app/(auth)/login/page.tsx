"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, Eye, EyeOff, Loader2, Lock, Mail } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { LoginSchema } from "@/lib/validations/tracker";
import { Button } from "@/components/ui/button";
import { GoogleAuthButton } from "@/components/shared/google-auth-button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { z } from "zod";

type LoginFormValues = z.infer<typeof LoginSchema>;

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = React.useState(false);
  const [showPassword, setShowPassword] = React.useState(false);

  const rawNext = searchParams.get("next") || searchParams.get("redirectTo");
  const safeNext =
    rawNext && rawNext.startsWith("/") && !rawNext.startsWith("//")
      ? rawNext
      : "/dashboard";

  const urlError = searchParams.get("error");
  React.useEffect(() => {
    if (urlError === "account_suspended") {
      toast.error("Your account has been suspended by an administrator.");
    } else if (urlError === "auth_callback_failed") {
      toast.error("Authentication callback failed. Please sign in again.");
    }
  }, [urlError]);

  // Detect recovery tokens (from email reset links or hash fragments) and redirect to /auth/reset-password
  React.useEffect(() => {
    if (typeof window !== "undefined") {
      const hash = window.location.hash;
      const isRecovery =
        hash.includes("type=recovery") || searchParams.get("type") === "recovery";
      if (isRecovery) {
        router.replace(`/auth/reset-password${hash}`);
        return;
      }
    }

    const supabase = createClient();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        router.replace("/auth/reset-password");
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [router, searchParams]);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(LoginSchema),
  });

  async function onSubmit(values: LoginFormValues) {
    setLoading(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({
        email: values.email,
        password: values.password,
      });

      if (error) {
        toast.error(error.message);
        return;
      }

      toast.success("Signed in successfully");
      router.push(safeNext);
      router.refresh();
    } catch {
      toast.error("Unexpected error signing in");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="glass-surface-1 border-[var(--border)] shadow-xl backdrop-blur-xl">
      <CardHeader className="space-y-1.5 p-5 pb-3 sm:p-6 sm:pb-4 text-left">
        <div className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-blue-500/10 text-blue-400 mb-1 border border-blue-500/20">
          <Lock className="h-4 w-4" />
        </div>
        <CardTitle className="text-xl sm:text-2xl font-bold tracking-tight text-[var(--foreground)]">
          Welcome back
        </CardTitle>
        <CardDescription className="text-xs sm:text-sm text-[var(--muted-foreground)]">
          Sign in to access your flight trackers and Telegram alerts.
        </CardDescription>
      </CardHeader>

      <CardContent className="p-5 pt-0 sm:p-6 sm:pt-0 space-y-4">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3.5">
          <div className="space-y-1.5">
            <label htmlFor="email" className="text-xs font-semibold text-[var(--foreground)]">
              Email address
            </label>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--muted-foreground)]" />
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="name@example.com"
                className="pl-10 text-sm min-h-[42px]"
                {...register("email")}
              />
            </div>
            {errors.email && (
              <p className="text-xs text-red-400 font-medium">{errors.email.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label htmlFor="password" className="text-xs font-semibold text-[var(--foreground)]">
                Password
              </label>
              <Link
                href="/forgot-password"
                className="text-xs font-medium text-sky-400 hover:text-sky-300 transition-colors"
              >
                Forgot password?
              </Link>
            </div>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--muted-foreground)]" />
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                placeholder="••••••••"
                className="pl-10 pr-10 text-sm font-mono tracking-wider min-h-[42px]"
                {...register("password")}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)] hover:text-[var(--foreground)] p-1 rounded-md cursor-pointer"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {errors.password && (
              <p className="text-xs text-red-400 font-medium">{errors.password.message}</p>
            )}
          </div>

          <Button type="submit" className="w-full gap-2 font-bold min-h-[44px] text-sm shadow-md cursor-pointer" disabled={loading}>
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <span>Sign In</span>
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </Button>
        </form>

        <div className="relative my-3">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-[var(--border)]" />
          </div>
          <div className="relative flex justify-center text-xs">
            <span className="bg-[var(--card)] px-3 font-medium text-[var(--muted-foreground)]">
              or continue with
            </span>
          </div>
        </div>

        <GoogleAuthButton mode="login" next={safeNext} />

        <p className="mt-3 text-center text-xs text-[var(--muted-foreground)]">
          Don&apos;t have an account yet?{" "}
          <Link
            href={safeNext !== "/dashboard" ? `/signup?next=${encodeURIComponent(safeNext)}` : "/signup"}
            className="font-bold text-sky-400 hover:text-sky-300 underline-offset-4 hover:underline"
          >
            Sign up
          </Link>
        </p>

        <div className="mt-4 pt-3 border-t border-[var(--border)] flex items-center justify-center gap-3 text-[11px] text-[var(--muted-foreground)]">
          <Link href="/terms" className="hover:text-white transition-colors">
            Terms
          </Link>
          <span>·</span>
          <Link href="/privacy" className="hover:text-white transition-colors">
            Privacy
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

export default function LoginPage() {
  return (
    <React.Suspense fallback={<div className="h-72 animate-pulse rounded-2xl glass-surface-2" />}>
      <LoginForm />
    </React.Suspense>
  );
}
