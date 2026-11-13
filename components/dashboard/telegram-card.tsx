"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  Bell,
  CheckCircle2,
  ExternalLink,
  Info,
  Loader2,
  Radio,
  Send,
  ShieldCheck,
  Unlink,
} from "lucide-react";
import { toast } from "sonner";
import { disconnectTelegramAction } from "@/app/dashboard/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { createClient } from "@/lib/supabase/client";
import { formatRelativeTime } from "@/lib/utils";

interface TelegramCardProps {
  isConnected: boolean;
  lastNotificationAt: string | null;
}

export function TelegramCard({ isConnected, lastNotificationAt }: TelegramCardProps) {
  const router = useRouter();
  const [loadingLink, setLoadingLink] = React.useState(false);
  const [sendingTest, setSendingTest] = React.useState(false);
  const [disconnecting, setDisconnecting] = React.useState(false);
  const [confirmDisconnect, setConfirmDisconnect] = React.useState(false);
  const [deepLink, setDeepLink] = React.useState<string | null>(null);

  async function callTelegramLinkFunction(action: "generate_link" | "send_test") {
    const supabase = createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
      throw new Error("Session expired. Please sign in again.");
    }

    const res = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/telegram-link`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ action }),
      },
    );

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || "Telegram request failed");
    }
    return data;
  }

  async function handleGenerateLink() {
    setLoadingLink(true);
    try {
      const data = await callTelegramLinkFunction("generate_link");
      setDeepLink(data.deep_link);
      toast.success("Secure linking token generated (valid for 15 minutes)");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to generate link");
    } finally {
      setLoadingLink(false);
    }
  }

  async function handleSendTest() {
    setSendingTest(true);
    try {
      await callTelegramLinkFunction("send_test");
      toast.success("Test notification delivered to your Telegram!");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to send test alert");
    } finally {
      setSendingTest(false);
    }
  }

  async function handleDisconnect() {
    setDisconnecting(true);
    try {
      const res = await disconnectTelegramAction();
      if (!res.ok) toast.error(res.message);
      else {
        toast.success(res.message);
        setDeepLink(null);
        setConfirmDisconnect(false);
        router.refresh();
      }
    } finally {
      setDisconnecting(false);
    }
  }

  const botUsername = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME || "MyFlightDropBot";

  return (
    <>
      <Card className="glass-surface-1 border-[var(--border)] shadow-xl overflow-hidden">
        <CardHeader className="border-b border-[var(--border)] glass-surface-2/40 pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2.5">
                <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-sky-500/15 text-sky-400 border border-sky-500/30 shadow-[0_0_12px_rgba(56,189,248,0.2)]">
                  <Radio className="h-4 w-4" />
                </span>
                <CardTitle className="text-base sm:text-lg font-extrabold tracking-tight">
                  Telegram Instant Notification Bot
                </CardTitle>
              </div>
              <CardDescription className="text-xs sm:text-sm">
                Get sub-second push notifications directly to Telegram when airline prices drop below your target.
              </CardDescription>
            </div>

            <div className="self-start sm:self-auto">
              {isConnected ? (
                <Badge variant="success" dot className="text-xs">
                  Bot Connected &amp; Active
                </Badge>
              ) : (
                <Badge variant="warning" dot className="text-xs">
                  Not Linked
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-4 sm:p-6 space-y-5">
          {isConnected ? (
            <div className="space-y-4">
              <div className="rounded-2xl border border-emerald-500/30 glass-surface-2 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-start gap-3.5">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 shadow-[0_0_15px_rgba(16,185,129,0.2)]">
                    <CheckCircle2 className="h-5 w-5" />
                  </div>
                  <div className="space-y-1">
                    <h4 className="text-sm font-bold text-[var(--foreground)]">
                      Your Telegram account is cryptographically paired
                    </h4>
                    <p className="text-xs text-[var(--muted-foreground)] leading-relaxed">
                      Bot: <strong className="text-sky-400 font-mono">@{botUsername}</strong> · Price drops, fare rebounds, and target alerts will dispatch instantly.
                    </p>
                    {lastNotificationAt && (
                      <p className="text-[11px] text-[var(--muted-foreground)]">
                        Last alert received: {formatRelativeTime(lastNotificationAt)}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 sm:self-center">
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 text-xs font-bold"
                    disabled={sendingTest}
                    onClick={handleSendTest}
                  >
                    {sendingTest ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                    <span>Send Test Ping</span>
                  </Button>

                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-1.5 text-xs text-red-400 hover:text-red-300 hover:bg-red-500/15 rounded-xl font-semibold"
                    onClick={() => setConfirmDisconnect(true)}
                  >
                    <Unlink className="h-3.5 w-3.5" />
                    <span>Disconnect</span>
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              <div className="rounded-2xl border border-[var(--border)] glass-surface-2 p-4 sm:p-5 space-y-3">
                <h4 className="font-bold text-sm text-[var(--foreground)] flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-sky-400" />
                  Two-Step Safe Bot Pairing Flow
                </h4>
                <ol className="list-decimal list-inside space-y-1.5 text-xs sm:text-sm text-[var(--muted-foreground)] leading-relaxed">
                  <li>Click <strong>&ldquo;Generate Secure Bot Link&rdquo;</strong> below to create a single-use authentication token.</li>
                  <li>Click <strong>&ldquo;Open in Telegram&rdquo;</strong> and press <strong>START</strong> in your chat with <strong className="text-[var(--foreground)] font-mono">@{botUsername}</strong>.</li>
                </ol>
              </div>

              {!deepLink ? (
                <Button
                  onClick={handleGenerateLink}
                  disabled={loadingLink}
                  className="gap-2 min-h-[46px] font-bold text-sm shadow-md"
                >
                  {loadingLink ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Radio className="h-4 w-4" />
                  )}
                  <span>Generate Secure Bot Link</span>
                </Button>
              ) : (
                <div className="rounded-2xl border border-sky-500/40 glass-surface-2 p-4.5 space-y-3 animate-in fade-in duration-150">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-sky-300">
                      Link active for 15 minutes
                    </span>
                    <Badge variant="outline" className="text-[10px] font-mono">
                      Single-use token
                    </Badge>
                  </div>
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                    <a
                      href={deepLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl btn-glass-primary px-5 py-2.5 text-sm font-bold text-white shadow-md transition-all text-center"
                    >
                      <span>Open @{botUsername} in Telegram</span>
                      <ExternalLink className="h-4 w-4" />
                    </a>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setDeepLink(null)}
                      className="text-xs text-[var(--muted-foreground)] hover:text-white"
                    >
                      Cancel Token
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Disconnect Modal */}
      {confirmDisconnect && (
        <Dialog open={confirmDisconnect} onOpenChange={() => setConfirmDisconnect(false)}>
          <div className="space-y-4 text-center sm:text-left">
            <div className="space-y-2">
              <h3 className="text-lg font-bold text-[var(--foreground)]">Disconnect Telegram Bot?</h3>
              <p className="text-xs sm:text-sm text-[var(--muted-foreground)] leading-relaxed">
                You will stop receiving real-time price drop notifications for your tracked flights. You can reconnect anytime.
              </p>
            </div>

            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2.5 pt-2">
              <Button
                variant="outline"
                className="w-full sm:w-auto font-semibold"
                onClick={() => setConfirmDisconnect(false)}
              >
                Keep Connected
              </Button>
              <Button
                variant="destructive"
                className="w-full sm:w-auto font-bold"
                disabled={disconnecting}
                onClick={handleDisconnect}
              >
                {disconnecting && <Loader2 className="h-4 w-4 animate-spin" />}
                Confirm Disconnect
              </Button>
            </div>
          </div>
        </Dialog>
      )}
    </>
  );
}
