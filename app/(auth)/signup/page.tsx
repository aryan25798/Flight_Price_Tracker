"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, CheckCircle2, Eye, EyeOff, Loader2, Lock, Mail, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { SignupSchema } from "@/lib/validations/tracker";
import { Button } from "@/components/ui/button";
import { GoogleAuthButton } from "@/components/shared/google-auth-button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { getAppUrl } from "@/lib/utils";
import { z } from "zod";

type SignupFormValues = z.infer<typeof SignupSchema>;

function SignupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = React.useState(false);
  const [showPassword, setShowPassword] = React.useState(false);
  const [signedUpEmail, setSignedUpEmail] = React.useState<string | null>(null);

  const rawNext = searchParams.get("next") || searchParams.get("redirectTo");
  const safeNext =
    rawNext && rawNext.startsWith("/") && !rawNext.startsWith("//")
      ? rawNext
      : "/dashboard";

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SignupFormValues>({
    resolver: zodResolver(SignupSchema),
  });

  async function onSubmit(values: SignupFormValues) {
    setLoading(true);
    try {
      const supabase = createClient();
      const appUrl = getAppUrl();
      const redirectUrl = `${appUrl}/auth/callback?next=${encodeURIComponent(safeNext)}`;

      const { data, error } = await supabase.auth.signUp({
        email: values.email,
        password: values.password,
        options: {
          emailRedirectTo: redirectUrl,
        },
      });

      if (error) {
        toast.error(error.message);
        return;
      }

      if (data.session) {
        toast.success("Account created! Redirecting...");
        router.push(safeNext);
        router.refresh();
      } else {
        setSignedUpEmail(values.email);
        toast.success("Confirmation link sent to your email!");
      }
    } catch {
      toast.error("Unexpected error creating account");
    } finally {
      setLoading(false);
    }
  }

  if (signedUpEmail) {
    return (
      <Card className="glass-surface-1 border-[var(--border)] shadow-2xl backdrop-blur-2xl text-center">
        <CardHeader className="space-y-1.5 p-4 sm:p-5 pb-3">
          <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 shadow-[0_0_12px_rgba(16,185,129,0.25)]">
            <CheckCircle2 className="h-5 w-5" />
          </div>
          <CardTitle className="text-lg sm:text-xl font-bold tracking-tight">Check your inbox</CardTitle>
          <CardDescription className="text-xs">
            We sent a verification link to <strong className="text-[var(--foreground)]">{signedUpEmail}</strong>.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4 pt-0 sm:p-5 sm:pt-0 space-y-3">
          <p className="text-[11px] text-[var(--muted-foreground)] leading-relaxed">
            Click the link in the email to activate your account. Once verified, you will be automatically redirected to your destination.
          </p>
          <Link
            href={safeNext !== "/dashboard" ? `/login?next=${encodeURIComponent(safeNext)}` : "/login"}
            className="block w-full pt-1"
          >
            <Button variant="outline" className="w-full font-semibold text-xs min-h-[38px]">
              Back to Sign In
            </Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="glass-surface-1 border-[var(--border)] shadow-xl backdrop-blur-xl">
      <CardHeader className="space-y-1.5 p-5 pb-3 sm:p-6 sm:pb-4 text-left">
        <div className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-blue-500/10 text-blue-400 mb-1 border border-blue-500/20">
          <UserPlus className="h-4 w-4" />
        </div>
        <CardTitle className="text-xl sm:text-2xl font-bold tracking-tight text-[var(--foreground)]">
          Create account
        </CardTitle>
        <CardDescription className="text-xs sm:text-sm text-[var(--muted-foreground)]">
          Start tracking real-time flight price drops and get Telegram alerts.
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
            <label htmlFor="password" className="text-xs font-semibold text-[var(--foreground)]">
              Password
            </label>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--muted-foreground)]" />
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                placeholder="At least 8 characters"
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
                <span>Get Started Free</span>
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

        <GoogleAuthButton mode="signup" next={safeNext} />

        <p className="mt-3 text-center text-xs text-[var(--muted-foreground)]">
          Already have an account?{" "}
          <Link
            href={safeNext !== "/dashboard" ? `/login?next=${encodeURIComponent(safeNext)}` : "/login"}
            className="font-bold text-sky-400 hover:text-sky-300 underline-offset-4 hover:underline"
          >
            Sign in
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}

export default function SignupPage() {
  return (
    <React.Suspense fallback={<div className="h-72 animate-pulse rounded-2xl glass-surface-2" />}>
      <SignupForm />
    </React.Suspense>
  );
}
