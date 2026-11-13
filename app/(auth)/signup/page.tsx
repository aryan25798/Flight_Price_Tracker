"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
import { z } from "zod";

type SignupFormValues = z.infer<typeof SignupSchema>;

export default function SignupPage() {
  const router = useRouter();
  const [loading, setLoading] = React.useState(false);
  const [showPassword, setShowPassword] = React.useState(false);
  const [signedUpEmail, setSignedUpEmail] = React.useState<string | null>(null);

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
      const { data, error } = await supabase.auth.signUp({
        email: values.email,
        password: values.password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (error) {
        toast.error(error.message);
        return;
      }

      if (data.session) {
        toast.success("Account created! Redirecting to dashboard...");
        router.push("/dashboard");
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
        <CardHeader className="space-y-2 pb-4">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 shadow-[0_0_15px_rgba(16,185,129,0.25)]">
            <CheckCircle2 className="h-6 w-6" />
          </div>
          <CardTitle className="text-xl font-bold tracking-tight">Check your inbox</CardTitle>
          <CardDescription className="text-xs sm:text-sm">
            We sent a verification link to <strong className="text-[var(--foreground)]">{signedUpEmail}</strong>.
            Click the link in the email to activate your account.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 pt-2">
          <div className="rounded-xl glass-surface-2 border border-[var(--border)] p-3.5 text-xs text-[var(--muted-foreground)]">
            Can&apos;t find the email? Check your spam folder or verify that your email address was typed correctly.
          </div>
          <Link href="/login" className="block w-full">
            <Button variant="outline" className="w-full font-semibold">
              Back to Sign In
            </Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="glass-surface-1 border-[var(--border)] shadow-2xl backdrop-blur-2xl">
      <CardHeader className="space-y-1.5 pb-4 text-center sm:text-left">
        <div className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-sky-500/15 text-sky-400 mb-1 mx-auto sm:mx-0 border border-sky-500/30 shadow-[0_0_12px_rgba(56,189,248,0.2)]">
          <UserPlus className="h-4 w-4" />
        </div>
        <CardTitle className="text-xl sm:text-2xl font-bold tracking-tight">
          Create an Account
        </CardTitle>
        <CardDescription className="text-xs sm:text-sm">
          Start tracking flight routes with automated 4-hour checks.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="email" className="text-xs font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
              Email Address
            </label>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--muted-foreground)]" />
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="name@example.com"
                className="pl-10 text-sm"
                {...register("email")}
              />
            </div>
            {errors.email && (
              <p className="text-xs text-red-400 font-medium">{errors.email.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <label htmlFor="password" className="text-xs font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
              Password
            </label>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--muted-foreground)]" />
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                placeholder="At least 6 characters"
                className="pl-10 pr-10 text-sm font-mono tracking-widest"
                {...register("password")}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)] hover:text-[var(--foreground)] p-1 rounded-md"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {errors.password && (
              <p className="text-xs text-red-400 font-medium">{errors.password.message}</p>
            )}
          </div>

          <Button type="submit" className="w-full gap-2 font-bold min-h-[46px] text-sm shadow-md" disabled={loading}>
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

        <div className="relative my-4">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-[var(--border)]" />
          </div>
          <div className="relative flex justify-center text-xs uppercase tracking-wider">
            <span className="bg-[var(--glass-surface-1)] px-3 font-semibold text-[var(--muted-foreground)]">
              or continue with
            </span>
          </div>
        </div>

        <GoogleAuthButton mode="signup" />

        <p className="mt-5 text-center text-xs text-[var(--muted-foreground)]">
          Already have an account?{" "}
          <Link href="/login" className="font-bold text-sky-400 hover:text-sky-300 underline-offset-4 hover:underline">
            Sign in
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
