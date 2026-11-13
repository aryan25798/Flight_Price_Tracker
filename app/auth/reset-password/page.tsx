"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Key, Loader2, Lock, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [loading, setLoading] = React.useState(false);

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
        return;
      }
      toast.success("Password updated successfully! Redirecting to dashboard...");
      router.push("/dashboard");
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
            Choose a secure password of at least 8 characters.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="new-password" className="text-xs font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
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
              <label htmlFor="confirm-password" className="text-xs font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
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

            <Button type="submit" className="w-full min-h-[46px] font-bold text-sm shadow-md" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              Set New Password &amp; Continue
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
