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
        <CardHeader className="space-y-1.5 p-4 sm:p-5 pb-3">
          <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 shadow-[0_0_12px_rgba(16,185,129,0.25)]">
            <CheckCircle2 className="h-5 w-5" />
          </div>
          <CardTitle className="text-lg sm:text-xl font-bold tracking-tight">Check your inbox</CardTitle>
          <CardDescription className="text-xs">
            We sent a verification link to <strong className="text-[var(--foreground)]">{signedUpEmail}</strong>.
            Click the link in the email to activate your account.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4 pt-0 sm:p-5 sm:pt-0 space-y-2.5">
          <div className="rounded-xl glass-surface-2 border border-[var(--border)] p-3 text-[11px] text-[var(--muted-foreground)] leading-relaxed">
            Can&apos;t find the email? Check your spam folder or verify your address.
          </div>
          <Link href="/login" className="block w-full">
            <Button variant="outline" className="w-full font-semibold text-xs min-h-[38px]">
              Back to Sign In
            </Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="glass-surface-1 border-[var(--border)] shadow-2xl backdrop-blur-2xl">
      <CardHeader className="space-y-1 p-4 pb-2 sm:p-5 sm:pb-3 text-center sm:text-left">
        <div className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-sky-500/15 text-sky-400 mb-0.5 mx-auto sm:mx-0 border border-sky-500/30 shadow-[0_0_10px_rgba(56,189,248,0.2)]">
          <UserPlus className="h-3.5 w-3.5" />
        </div>
        <CardTitle className="text-lg sm:text-xl font-bold tracking-tight">
          Create an Account
        </CardTitle>
        <CardDescription className="text-[11px] sm:text-xs">
          Start tracking flight routes with automated 4-hour checks.
        </CardDescription>
      </CardHeader>

      <CardContent className="p-4 pt-0 sm:p-5 sm:pt-0 space-y-3">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-2.5 sm:space-y-3">
          <div className="space-y-1">
            <label htmlFor="email" className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-[var(--muted-foreground)]">
              Email Address
            </label>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--muted-foreground)]" />
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="name@example.com"
                className="pl-9 text-xs sm:text-sm min-h-[38px] sm:min-h-[40px] py-1.5"
                {...register("email")}
              />
            </div>
            {errors.email && (
              <p className="text-[11px] text-red-400 font-medium">{errors.email.message}</p>
            )}
          </div>

          <div className="space-y-1">
            <label htmlFor="password" className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-[var(--muted-foreground)]">
              Password
            </label>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--muted-foreground)]" />
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                placeholder="At least 6 characters"
                className="pl-9 pr-9 text-xs sm:text-sm font-mono tracking-widest min-h-[38px] sm:min-h-[40px] py-1.5"
                {...register("password")}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)] hover:text-[var(--foreground)] p-1 rounded-md"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              </button>
            </div>
            {errors.password && (
              <p className="text-[11px] text-red-400 font-medium">{errors.password.message}</p>
            )}
          </div>

          <Button type="submit" className="w-full gap-2 font-bold min-h-[40px] sm:min-h-[42px] text-xs sm:text-sm shadow-md cursor-pointer" disabled={loading}>
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <span>Get Started Free</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </>
            )}
          </Button>
        </form>

        <div className="relative my-2 sm:my-2.5">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-[var(--border)]" />
          </div>
          <div className="relative flex justify-center text-[10px] uppercase tracking-wider">
            <span className="bg-[var(--glass-surface-1)] px-2.5 font-bold text-[var(--muted-foreground)]">
              or continue with
            </span>
          </div>
        </div>

        <GoogleAuthButton mode="signup" />

        <p className="mt-2 text-center text-xs text-[var(--muted-foreground)]">
          Already have an account?{" "}
          <Link href="/login" className="font-bold text-sky-400 hover:text-sky-300 underline-offset-4 hover:underline">
            Sign in
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
