import { createClient, getAuthenticatedProfile } from "@/lib/supabase/server";
import { TelegramCard } from "@/components/dashboard/telegram-card";
import { PwaPushCard } from "@/components/pwa/pwa-push-card";
import { DeleteAccountCard } from "@/components/dashboard/delete-account-card";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDateShort } from "@/lib/utils";
import { Bell, Layers, Plane, ShieldCheck, User } from "lucide-react";

export default async function SettingsPage() {
  const { user, profile } = await getAuthenticatedProfile();
  const supabase = await createClient();

  const [
    { data: lastNotification },
    { count: activeTrackersCount },
  ] = await Promise.all([
    supabase
      .from("notification_logs")
      .select("sent_at")
      .eq("user_id", user.id)
      .eq("delivery_status", "sent")
      .order("sent_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("tracked_flights")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("is_active", true),
  ]);

  const isSuperAdmin = profile.role === "super_admin";
  const userTier = profile.tier || "free";
  const isUnlimited =
    isSuperAdmin ||
    profile.custom_tracker_limit === -1 ||
    (userTier === "enterprise" && profile.custom_tracker_limit === null);

  const effectiveLimit = isUnlimited
    ? -1
    : profile.custom_tracker_limit !== null && profile.custom_tracker_limit !== undefined
      ? profile.custom_tracker_limit
      : userTier === "pro"
        ? 25
        : 3;

  const activeCount = activeTrackersCount ?? 0;
  const usagePercentage = isUnlimited
    ? 15
    : Math.min(100, Math.round((activeCount / Math.max(1, effectiveLimit)) * 100));

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-sky-500/30 bg-sky-500/10 px-3 py-0.5 text-xs font-semibold text-sky-300">
              <ShieldCheck className="h-3.5 w-3.5 text-sky-400" />
              <span>Aviation Account Console</span>
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight text-[var(--foreground)]">
            Preferences &amp; Alert Channels
          </h2>
          <p className="text-xs sm:text-sm text-[var(--muted-foreground)] leading-relaxed max-w-2xl">
            Configure your triple-redundancy notification channels (Telegram Bot, SMTP Email, W3C Web Push) and track your subscription quota.
          </p>
        </div>

        <Badge
          variant={isUnlimited ? "cyan" : userTier === "pro" ? "success" : "secondary"}
          dot
          className="self-start sm:self-auto text-xs font-semibold capitalize"
        >
          {isSuperAdmin ? "Super Admin" : `${userTier} Plan`}
        </Badge>
      </div>

      {/* Plan Quota & Fleet Usage Meter Card */}
      <div className="rounded-2xl border border-[var(--border)] glass-surface-1 p-5 sm:p-6 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Layers className="h-4 w-4 text-sky-400" />
              <h3 className="text-sm font-bold text-[var(--foreground)]">Flight Radar Capacity</h3>
            </div>
            <p className="text-xs text-[var(--muted-foreground)]">
              {isUnlimited
                ? "You have uncapped autonomous radar capacity with no tracker limits."
                : `Active monitored routes out of your ${effectiveLimit} allowed tracker slots.`}
            </p>
          </div>

          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black tabular-nums text-white">{activeCount}</span>
            <span className="text-xs text-slate-400 font-mono">
              / {isUnlimited ? "∞" : effectiveLimit} Active
            </span>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="space-y-1.5">
          <div className="h-2 w-full rounded-full bg-slate-800/80 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                usagePercentage > 85
                  ? "bg-amber-500"
                  : "bg-gradient-to-r from-sky-500 to-cyan-400"
              }`}
              style={{ width: `${usagePercentage}%` }}
            />
          </div>
          <div className="flex justify-between text-[11px] text-slate-400">
            <span>{isUnlimited ? "Uncapped allocation" : `${usagePercentage}% capacity utilized`}</span>
            <span>{isUnlimited ? "Unlimited routes" : `${Math.max(0, effectiveLimit - activeCount)} slots remaining`}</span>
          </div>
        </div>
      </div>

      {/* Primary Alert Channels: Telegram & Web Push */}
      <div className="space-y-6">
        <div className="space-y-1">
          <h3 className="text-base font-bold text-[var(--foreground)] flex items-center gap-2">
            <Bell className="h-4 w-4 text-sky-400" />
            <span>Alert Channels</span>
          </h3>
          <p className="text-xs text-[var(--muted-foreground)]">
            Connect your devices to receive zero-latency flight price drop notifications.
          </p>
        </div>

        <TelegramCard
          isConnected={Boolean(profile.telegram_chat_id)}
          lastNotificationAt={lastNotification?.sent_at ?? null}
        />

        <PwaPushCard />
      </div>

      {/* Account Details */}
      <Card className="glass-surface-1 border-[var(--border)] shadow-xl">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-sky-400" />
            <CardTitle className="text-base font-bold">Profile &amp; Credentials</CardTitle>
          </div>
          <CardDescription className="text-xs">
            Your verified identity and role within the AeroDrop intelligence network.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl glass-surface-2 p-3.5 border border-[var(--border)] space-y-1">
            <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted-foreground)]">
              Email Address
            </p>
            <p className="font-semibold text-sm text-[var(--foreground)] truncate">{profile.email}</p>
          </div>
          <div className="rounded-xl glass-surface-2 p-3.5 border border-[var(--border)] space-y-1">
            <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted-foreground)]">
              Account Role
            </p>
            <p className="font-semibold text-sm capitalize text-[var(--foreground)]">
              {profile.role.replace("_", " ")}
            </p>
          </div>
          <div className="rounded-xl glass-surface-2 p-3.5 border border-[var(--border)] space-y-1">
            <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted-foreground)]">
              Member Since
            </p>
            <p className="font-semibold text-sm text-[var(--foreground)]">
              {formatDateShort(profile.created_at)}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Danger Zone */}
      <DeleteAccountCard userEmail={profile.email} />
    </div>
  );
}
