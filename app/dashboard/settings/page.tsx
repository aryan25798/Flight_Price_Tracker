import { createClient, getAuthenticatedProfile } from "@/lib/supabase/server";
import { TelegramCard } from "@/components/dashboard/telegram-card";
import { PwaPushCard } from "@/components/pwa/pwa-push-card";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateShort } from "@/lib/utils";

export default async function SettingsPage() {
  const { user, profile } = await getAuthenticatedProfile();
  const supabase = await createClient();

  const { data: lastNotification } = await supabase
    .from("notification_logs")
    .select("sent_at")
    .eq("user_id", user.id)
    .eq("delivery_status", "sent")
    .order("sent_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight text-[var(--foreground)]">
          Notifications &amp; Account Settings
        </h2>
        <p className="text-xs sm:text-sm text-[var(--muted-foreground)] leading-relaxed">
          Manage your triple-redundancy price alert channels (Telegram bot, custom SMTP email, native browser push) and device settings.
        </p>
      </div>

      <TelegramCard
        isConnected={Boolean(profile.telegram_chat_id)}
        lastNotificationAt={lastNotification?.sent_at ?? null}
      />

      <PwaPushCard />

      <Card className="glass-surface-1 border-[var(--border)] shadow-xl">
        <CardHeader>
          <CardTitle>Account Details</CardTitle>
          <CardDescription>Your authenticated profile and security status.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 text-sm sm:grid-cols-3">
          <div className="rounded-xl glass-surface-2 p-3.5 border border-[var(--border)] space-y-1">
            <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted-foreground)]">Email</p>
            <p className="font-semibold text-sm text-[var(--foreground)] truncate">{profile.email}</p>
          </div>
          <div className="rounded-xl glass-surface-2 p-3.5 border border-[var(--border)] space-y-1">
            <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted-foreground)]">Role</p>
            <p className="font-semibold text-sm capitalize text-[var(--foreground)]">{profile.role.replace("_", " ")}</p>
          </div>
          <div className="rounded-xl glass-surface-2 p-3.5 border border-[var(--border)] space-y-1">
            <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted-foreground)]">Member Since</p>
            <p className="font-semibold text-sm text-[var(--foreground)]">{formatDateShort(profile.created_at)}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
