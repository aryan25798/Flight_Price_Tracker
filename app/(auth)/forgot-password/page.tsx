"use client";

import * as React from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, CheckCircle2, KeyRound, Loader2, Mail } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { ForgotPasswordSchema } from "@/lib/validations/tracker";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { z } from "zod";

type ForgotValues = z.infer<typeof ForgotPasswordSchema>;

export default function ForgotPasswordPage() {
  const [loading, setLoading] = React.useState(false);
  const [sent, setSent] = React.useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotValues>({
    resolver: zodResolver(ForgotPasswordSchema),
  });

  async function onSubmit(values: ForgotValues) {
    setLoading(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.resetPasswordForEmail(values.email, {
        redirectTo: `${window.location.origin}/auth/callback?next=/auth/reset-password`,
      });

      if (error) {
        toast.error(error.message);
        return;
      }

      setSent(true);
      toast.success("Password reset email sent if an account exists.");
    } catch {
      toast.error("Failed to send reset email");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="glass-surface-1 border-[var(--border)] shadow-2xl backdrop-blur-2xl">
      <CardHeader className="space-y-1.5 pb-4 text-center sm:text-left">
        <div className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-sky-500/15 text-sky-400 mb-1 mx-auto sm:mx-0 border border-sky-500/30 shadow-[0_0_12px_rgba(56,189,248,0.2)]">
          <KeyRound className="h-4 w-4" />
        </div>
        <CardTitle className="text-xl sm:text-2xl font-bold tracking-tight">
          Reset Password
        </CardTitle>
        <CardDescription className="text-xs sm:text-sm">
          Enter your registered email and we&apos;ll send you a secure recovery link.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {sent ? (
          <div className="space-y-4 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 shadow-[0_0_15px_rgba(16,185,129,0.25)]">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <div className="space-y-1">
              <h4 className="text-sm font-bold text-[var(--foreground)]">Reset instructions dispatched</h4>
              <p className="text-xs text-[var(--muted-foreground)]">
                If an account exists with this email, you will receive password reset instructions shortly.
              </p>
            </div>
            <Link href="/login" className="block w-full pt-2">
              <Button variant="outline" className="w-full font-semibold">
                Back to Sign In
              </Button>
            </Link>
          </div>
        ) : (
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

            <Button type="submit" className="w-full min-h-[46px] font-bold text-sm shadow-md" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              Send Recovery Link
            </Button>

            <p className="text-center text-xs text-[var(--muted-foreground)] pt-2">
              <Link href="/login" className="inline-flex items-center gap-1.5 font-bold text-sky-400 hover:text-sky-300">
                <ArrowLeft className="h-3.5 w-3.5" />
                <span>Return to sign in</span>
              </Link>
            </p>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
