"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Bell,
  CheckCircle,
  Clock,
  Database,
  Gauge,
  HardDrive,
  Loader2,
  Lock,
  Mail,
  Save,
  Send,
  ShieldAlert,
  Sliders,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { adminActionDispatch, testSmtpConnectionAction } from "@/app/admin/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

interface SettingsValues {
  polling_interval_minutes: number;
  max_api_calls_per_cycle: number;
  max_concurrent_requests: number;
  notification_cooldown_hours: number;
  price_drop_threshold_percent: number;
  price_history_retention_days: number;
  max_trackers_per_user: number;
  max_route_retries: number;
  maintenance_mode: boolean;
}

export function SettingsForm({ initial }: { initial: SettingsValues }) {
  const router = useRouter();
  const [values, setValues] = React.useState<SettingsValues>(initial);
  const [saving, setSaving] = React.useState(false);
  const [testEmail, setTestEmail] = React.useState("");
  const [sendingTest, setSendingTest] = React.useState(false);

  async function handleSendTestEmail(e: React.FormEvent) {
    e.preventDefault();
    if (!testEmail || !testEmail.includes("@")) {
      toast.error("Please enter a valid email address for testing");
      return;
    }
    setSendingTest(true);
    try {
      const res = await testSmtpConnectionAction(testEmail.trim());
      if (!res.ok) {
        toast.error(res.message);
      } else {
        toast.success(res.message);
      }
    } catch {
      toast.error("Failed to dispatch test email. Check server logs.");
    } finally {
      setSendingTest(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await adminActionDispatch(
        { action: "update_settings", settings: values },
        ["/admin/settings", "/admin/audit-logs"],
      );
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("System operational parameters updated successfully");
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[var(--foreground)]">
            Engine & Quota Settings
          </h1>
          <p className="text-xs sm:text-sm text-[var(--muted-foreground)]">
            Configure price polling cadence, throttling thresholds, database retention, and platform maintenance mode.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={values.maintenance_mode ? "destructive" : "emerald"} dot className="text-xs">
            {values.maintenance_mode ? "Maintenance Active" : "Engine Running"}
          </Badge>
          <Button type="submit" disabled={saving} size="sm" className="h-9 px-4 text-xs font-semibold">
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Save className="h-3.5 w-3.5 mr-1.5" />}
            Save Parameters
          </Button>
        </div>
      </div>

      {/* Maintenance Mode Banner / Switch */}
      <Card
        className={`glass-panel border transition-colors ${
          values.maintenance_mode
            ? "border-red-500/40 bg-red-500/5"
            : "border-[var(--border)]"
        }`}
      >
        <CardContent className="p-4 sm:p-5">
          <label className="flex items-start sm:items-center justify-between gap-4 cursor-pointer">
            <div className="flex items-start gap-3">
              <div
                className={`mt-0.5 sm:mt-0 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                  values.maintenance_mode
                    ? "bg-red-500/20 text-red-500"
                    : "bg-[var(--muted)] text-[var(--muted-foreground)]"
                }`}
              >
                <ShieldAlert className="h-5 w-5" />
              </div>
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-[var(--foreground)]">
                    Platform Maintenance Mode
                  </span>
                  {values.maintenance_mode && (
                    <Badge variant="destructive" className="text-[10px]">
                      Live
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-[var(--muted-foreground)]">
                  When enabled, all background price checks, scheduled pg_cron tasks, and new user tracker creation are halted immediately.
                </p>
              </div>
            </div>

            <div className="relative inline-flex items-center shrink-0">
              <input
                type="checkbox"
                checked={values.maintenance_mode}
                onChange={(e) => setValues({ ...values, maintenance_mode: e.target.checked })}
                className="sr-only peer"
                id="maintenance-toggle"
              />
              <div className="w-11 h-6 bg-[var(--muted)] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-red-600"></div>
            </div>
          </label>
        </CardContent>
      </Card>

      {/* Section 1: Polling & Quotas */}
      <Card className="glass-panel border-[var(--border)]">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2 text-amber-500">
            <Clock className="h-4 w-4" />
            <CardTitle className="text-base">Price Polling & API Quota Protection</CardTitle>
          </div>
          <CardDescription className="text-xs">
            Parameters controlling scheduled flight check execution frequency and partner API rate bounds.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 pt-1">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-[var(--foreground)]">
                  Polling Interval
                </label>
                <span className="font-mono text-[11px] text-[var(--muted-foreground)]">
                  60–1440 min
                </span>
              </div>
              <div className="relative">
                <Input
                  type="number"
                  min={60}
                  max={1440}
                  value={values.polling_interval_minutes}
                  onChange={(e) =>
                    setValues({ ...values, polling_interval_minutes: Number(e.target.value) })
                  }
                  className="h-10 text-xs sm:text-sm font-mono pr-14"
                />
                <span className="absolute right-3 top-2.5 text-xs text-[var(--muted-foreground)] pointer-events-none">
                  min
                </span>
              </div>
              <p className="text-[11px] text-[var(--muted-foreground)]">
                Frequency for pg_cron to invoke the Edge Function price checker.
              </p>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-[var(--foreground)]">
                  Max Calls / Run
                </label>
                <span className="font-mono text-[11px] text-[var(--muted-foreground)]">
                  1–200 calls
                </span>
              </div>
              <div className="relative">
                <Input
                  type="number"
                  min={1}
                  max={200}
                  value={values.max_api_calls_per_cycle}
                  onChange={(e) =>
                    setValues({ ...values, max_api_calls_per_cycle: Number(e.target.value) })
                  }
                  className="h-10 text-xs sm:text-sm font-mono pr-14"
                />
                <span className="absolute right-3 top-2.5 text-xs text-[var(--muted-foreground)] pointer-events-none">
                  reqs
                </span>
              </div>
              <p className="text-[11px] text-[var(--muted-foreground)]">
                Hard ceiling on Travelpayouts requests per cron execution cycle.
              </p>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-[var(--foreground)]">
                  Concurrency Ceiling
                </label>
                <span className="font-mono text-[11px] text-[var(--muted-foreground)]">
                  1–10 streams
                </span>
              </div>
              <div className="relative">
                <Input
                  type="number"
                  min={1}
                  max={10}
                  value={values.max_concurrent_requests}
                  onChange={(e) =>
                    setValues({ ...values, max_concurrent_requests: Number(e.target.value) })
                  }
                  className="h-10 text-xs sm:text-sm font-mono pr-14"
                />
                <span className="absolute right-3 top-2.5 text-xs text-[var(--muted-foreground)] pointer-events-none">
                  concur
                </span>
              </div>
              <p className="text-[11px] text-[var(--muted-foreground)]">
                Parallel HTTP worker threads dispatched during batch checks.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Section 2: Notifications & Alert Thresholds */}
      <Card className="glass-panel border-[var(--border)]">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2 text-cyan-500">
            <Bell className="h-4 w-4" />
            <CardTitle className="text-base">Notification & Sensitivity Thresholds</CardTitle>
          </div>
          <CardDescription className="text-xs">
            Throttle notification spam while ensuring significant flash price drops trigger instant Telegram alerts.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 pt-1">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-[var(--foreground)]">
                  Notification Cooldown
                </label>
                <span className="font-mono text-[11px] text-[var(--muted-foreground)]">
                  1–168 hours
                </span>
              </div>
              <div className="relative">
                <Input
                  type="number"
                  min={1}
                  max={168}
                  value={values.notification_cooldown_hours}
                  onChange={(e) =>
                    setValues({ ...values, notification_cooldown_hours: Number(e.target.value) })
                  }
                  className="h-10 text-xs sm:text-sm font-mono pr-14"
                />
                <span className="absolute right-3 top-2.5 text-xs text-[var(--muted-foreground)] pointer-events-none">
                  hrs
                </span>
              </div>
              <p className="text-[11px] text-[var(--muted-foreground)]">
                Minimum wait time before dispatching another notification for the same flight.
              </p>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-[var(--foreground)]">
                  Flash Drop Exception Threshold
                </label>
                <span className="font-mono text-[11px] text-[var(--muted-foreground)]">
                  1–50 %
                </span>
              </div>
              <div className="relative">
                <Input
                  type="number"
                  min={1}
                  max={50}
                  value={values.price_drop_threshold_percent}
                  onChange={(e) =>
                    setValues({ ...values, price_drop_threshold_percent: Number(e.target.value) })
                  }
                  className="h-10 text-xs sm:text-sm font-mono pr-14"
                />
                <span className="absolute right-3 top-2.5 text-xs text-[var(--muted-foreground)] pointer-events-none">
                  % drop
                </span>
              </div>
              <p className="text-[11px] text-[var(--muted-foreground)]">
                Drops exceeding this percentage bypass the cooldown timer immediately.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Section 3: Retention & User Limits */}
      <Card className="glass-panel border-[var(--border)]">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2 text-emerald-500">
            <HardDrive className="h-4 w-4" />
            <CardTitle className="text-base">Database Retention & Subscription Bounds</CardTitle>
          </div>
          <CardDescription className="text-xs">
            Maintain database storage footprint within Supabase free-tier limits (500MB cap).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 pt-1">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-[var(--foreground)]">
                  Price History Retention
                </label>
                <span className="font-mono text-[11px] text-[var(--muted-foreground)]">
                  7–365 days
                </span>
              </div>
              <div className="relative">
                <Input
                  type="number"
                  min={7}
                  max={365}
                  value={values.price_history_retention_days}
                  onChange={(e) =>
                    setValues({ ...values, price_history_retention_days: Number(e.target.value) })
                  }
                  className="h-10 text-xs sm:text-sm font-mono pr-14"
                />
                <span className="absolute right-3 top-2.5 text-xs text-[var(--muted-foreground)] pointer-events-none">
                  days
                </span>
              </div>
              <p className="text-[11px] text-[var(--muted-foreground)]">
                Historical records older than this are safely purged daily via pg_cron.
              </p>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-[var(--foreground)]">
                  Max Trackers / User
                </label>
                <span className="font-mono text-[11px] text-[var(--muted-foreground)]">
                  1–100 routes
                </span>
              </div>
              <div className="relative">
                <Input
                  type="number"
                  min={1}
                  max={100}
                  value={values.max_trackers_per_user}
                  onChange={(e) =>
                    setValues({ ...values, max_trackers_per_user: Number(e.target.value) })
                  }
                  className="h-10 text-xs sm:text-sm font-mono pr-14"
                />
                <span className="absolute right-3 top-2.5 text-xs text-[var(--muted-foreground)] pointer-events-none">
                  routes
                </span>
              </div>
              <p className="text-[11px] text-[var(--muted-foreground)]">
                Per-account subscription cap to prevent denial-of-service spam.
              </p>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-[var(--foreground)]">
                  Max Route Retries
                </label>
                <span className="font-mono text-[11px] text-[var(--muted-foreground)]">
                  1–20 retries
                </span>
              </div>
              <div className="relative">
                <Input
                  type="number"
                  min={1}
                  max={20}
                  value={values.max_route_retries}
                  onChange={(e) =>
                    setValues({ ...values, max_route_retries: Number(e.target.value) })
                  }
                  className="h-10 text-xs sm:text-sm font-mono pr-14"
                />
                <span className="absolute right-3 top-2.5 text-xs text-[var(--muted-foreground)] pointer-events-none">
                  retries
                </span>
              </div>
              <p className="text-[11px] text-[var(--muted-foreground)]">
                Consecutive API failures before an active route is marked stalled.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Section 4: Custom SMTP Email Engine */}
      <Card className="glass-panel border-[var(--border)]">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2 text-sky-400">
            <Mail className="h-4 w-4" />
            <CardTitle className="text-base">Custom SMTP Email Engine Diagnostics</CardTitle>
          </div>
          <CardDescription className="text-xs">
            AeroDrop 2.0 dispatches automated tracker confirmations and flash price drop alerts using your custom SMTP credentials with zero external subscription costs.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 pt-1">
          <div className="rounded-xl border border-[var(--border)] bg-[var(--muted)]/20 p-3.5 space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-[var(--foreground)]">Supported SMTP Providers:</span>
              <Badge variant="cyan" dot className="text-[10px]">
                Active Engine
              </Badge>
            </div>
            <p className="text-[var(--muted-foreground)] leading-relaxed">
              Compatible with Gmail (App Password), Brevo, Amazon SES, SendGrid, Mailgun, Postmark, and private domain mail servers. Configured via <code className="font-mono text-sky-400">SMTP_HOST</code>, <code className="font-mono text-sky-400">SMTP_PORT</code>, <code className="font-mono text-sky-400">SMTP_USER</code>, <code className="font-mono text-sky-400">SMTP_PASS</code>, and <code className="font-mono text-sky-400">SMTP_FROM</code>.
            </p>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold text-[var(--foreground)]">
              Send Diagnostic Test Email
            </label>
            <div className="flex flex-col sm:flex-row gap-2.5">
              <Input
                type="email"
                placeholder="Enter recipient email (e.g. your-email@domain.com)..."
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
                className="h-10 text-xs sm:text-sm flex-1"
              />
              <Button
                type="button"
                disabled={sendingTest}
                onClick={handleSendTestEmail}
                variant="outline"
                className="h-10 px-4 text-xs font-semibold border-sky-500/30 text-sky-400 hover:text-sky-300 hover:bg-sky-500/10 shrink-0"
              >
                {sendingTest ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                ) : (
                  <Send className="h-3.5 w-3.5 mr-1.5" />
                )}
                Send Test Email
              </Button>
            </div>
            <p className="text-[11px] text-[var(--muted-foreground)]">
              Verifies end-to-end SMTP handshake, authentication, and inbox delivery.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex items-center justify-end gap-3 pt-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => setValues(initial)}
          disabled={saving}
          className="h-10 px-4 text-xs font-medium"
        >
          Reset to Loaded Values
        </Button>
        <Button
          type="submit"
          disabled={saving}
          className="h-10 px-6 text-xs font-semibold bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white shadow-xs"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
          Commit Operational Changes
        </Button>
      </div>
    </form>
  );
}
