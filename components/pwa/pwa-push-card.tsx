"use client";

import * as React from "react";
import {
  Bell,
  BellOff,
  BellRing,
  CheckCircle2,
  Download,
  Info,
  Loader2,
  Send,
  Smartphone,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const buffer = new ArrayBuffer(rawData.length);
  const outputArray = new Uint8Array(buffer);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function PwaPushCard() {
  const [isSupported, setIsSupported] = React.useState<boolean>(false);
  const [permission, setPermission] = React.useState<NotificationPermission>("default");
  const [isSubscribed, setIsSubscribed] = React.useState<boolean>(false);
  const [loading, setLoading] = React.useState<boolean>(false);
  const [testing, setTesting] = React.useState<boolean>(false);
  const [deferredPrompt, setDeferredPrompt] = React.useState<any>(null);
  const [isInstalled, setIsInstalled] = React.useState<boolean>(false);
  const [isBrave, setIsBrave] = React.useState<boolean>(false);

  React.useEffect(() => {
    if (typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window) {
      setIsSupported(true);
      setPermission(Notification.permission);

      // Detect Brave Browser
      if ((navigator as any).brave && typeof (navigator as any).brave.isBrave === "function") {
        (navigator as any).brave.isBrave().then((brave: boolean) => {
          if (brave) setIsBrave(true);
        }).catch(() => {});
      }

      // Check if already subscribed
      navigator.serviceWorker.ready.then(async (registration) => {
        const sub = await registration.pushManager.getSubscription();
        setIsSubscribed(Boolean(sub));
      });

      // Capture PWA install prompt
      const handleBeforeInstall = (e: Event) => {
        e.preventDefault();
        setDeferredPrompt(e);
      };

      window.addEventListener("beforeinstallprompt", handleBeforeInstall);

      // Check if already launched in standalone mode
      if (
        window.matchMedia("(display-mode: standalone)").matches ||
        (window.navigator as any).standalone === true
      ) {
        setIsInstalled(true);
      }

      return () => window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
    }
  }, []);

  async function handleToggleSubscription() {
    if (!isSupported) {
      toast.error("Push notifications are not supported in your current browser.");
      return;
    }

    setLoading(true);
    try {
      const registration = await navigator.serviceWorker.ready;

      if (isSubscribed) {
        // Unsubscribe
        const sub = await registration.pushManager.getSubscription();
        if (sub) {
          await sub.unsubscribe();
          await fetch("/api/push/subscribe", {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ endpoint: sub.endpoint }),
          });
        }
        setIsSubscribed(false);
        toast.success("Browser push notifications disabled.");
      } else {
        // Request permission and subscribe
        const perm = await Notification.requestPermission();
        setPermission(perm);

        if (perm !== "granted") {
          toast.error("Notification permission was denied. Please allow notifications in site settings.");
          return;
        }

        let vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
        if (!vapidPublicKey) {
          try {
            const keyRes = await fetch("/api/push/vapid-public-key");
            if (keyRes.ok) {
              const keyData = await keyRes.json();
              vapidPublicKey = keyData.publicKey;
            }
          } catch {
            // fallback
          }
        }

        if (!vapidPublicKey) {
          vapidPublicKey = "BJ8vwvXze5OJCIyVBd18NfT8BYzWAjXoY6TtMYIzANGf0nwUZ-t6GI9tM6vYtnUUxTffU_08-p9ymAaZq5Xff5s";
        }

        const convertedVapidKey = urlBase64ToUint8Array(vapidPublicKey);

        const subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: convertedVapidKey as BufferSource,
        });

        const res = await fetch("/api/push/subscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(subscription),
        });

        if (!res.ok) {
          throw new Error("Failed to register subscription with server");
        }

        setIsSubscribed(true);
        toast.success("Browser push notifications activated!");
      }
    } catch (err: unknown) {
      console.error("Push subscription error:", err);
      const msg = err instanceof Error ? err.message : "";
      if (
        msg.toLowerCase().includes("push service error") ||
        msg.toLowerCase().includes("registration failed")
      ) {
        toast.error(
          "Push service blocked by browser. If using Brave, enable 'Use Google services for push messaging' in brave://settings/privacy, or try Chrome/Edge.",
          { duration: 8000 },
        );
      } else {
        toast.error(msg || "Failed to update push subscription");
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleSendTestPush() {
    setTesting(true);
    try {
      const res = await fetch("/api/push/test", { method: "POST" });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        toast.error(data.message || "Failed to dispatch test push");
      } else {
        toast.success(data.message || "Test push notification dispatched!");
      }
    } catch {
      toast.error("Error communicating with push server");
    } finally {
      setTesting(false);
    }
  }

  async function handleInstallPwa() {
    if (!deferredPrompt) {
      toast.info("AeroDrop is already installed or your browser doesn't support 1-click install prompt.");
      return;
    }
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setIsInstalled(true);
      setDeferredPrompt(null);
      toast.success("AeroDrop App installed to your device!");
    }
  }

  return (
    <Card className="glass-surface-1 border-[var(--border)] shadow-xl overflow-hidden">
      <CardHeader className="border-b border-[var(--border)] glass-surface-2/40 pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-sky-500/15 text-sky-400 border border-sky-500/30 shadow-[0_0_12px_rgba(56,189,248,0.2)]">
                <BellRing className="h-4 w-4" />
              </span>
              <CardTitle className="text-base sm:text-lg font-extrabold tracking-tight">
                Native Browser Push &amp; PWA
              </CardTitle>
            </div>
            <CardDescription className="text-xs sm:text-sm">
              Receive instant desktop &amp; mobile lock-screen alerts for price drops even when the tab is closed.
            </CardDescription>
          </div>

          <div className="flex items-center gap-2">
            {isSubscribed ? (
              <Badge variant="emerald" dot className="text-xs font-semibold">
                Push Active
              </Badge>
            ) : (
              <Badge variant="secondary" className="text-xs">
                Push Inactive
              </Badge>
            )}
            {isInstalled && (
              <Badge variant="cyan" dot className="text-xs font-semibold border-cyan-500/30">
                PWA Installed
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-4 sm:p-6 space-y-5">
        <div className="grid gap-3.5 sm:grid-cols-2">
          {/* Card 1: Browser Push Notifications */}
          <div className="rounded-2xl glass-surface-2 p-4 border border-[var(--border)] space-y-3 flex flex-col justify-between">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 text-sky-400">
                <Bell className="h-4 w-4" />
                <h4 className="font-bold text-sm text-[var(--foreground)]">Lock-Screen Web Push</h4>
              </div>
              <p className="text-xs text-[var(--muted-foreground)] leading-relaxed">
                Connect your browser to receive native OS notifications for 4-hour radar updates and flash price drops.
              </p>
              {isBrave && !isSubscribed && (
                <div className="text-[11px] text-amber-300/90 bg-amber-500/10 border border-amber-500/20 rounded-xl p-2.5 leading-relaxed space-y-1">
                  <p className="font-semibold text-amber-200 flex items-center gap-1.5">
                    <Info className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                    Brave Browser Setup
                  </p>
                  <p>
                    Brave blocks push notifications by default. Enable{" "}
                    <span className="font-medium text-amber-100">&quot;Use Google services for push messaging&quot;</span> in{" "}
                    <code className="text-amber-200 bg-amber-950/40 px-1 py-0.5 rounded font-mono text-[10px]">brave://settings/privacy</code>{" "}
                    to receive lock-screen alerts.
                  </p>
                </div>
              )}
            </div>

            <div className="pt-2 flex items-center gap-2 flex-wrap">
              <Button
                size="sm"
                disabled={loading || !isSupported}
                onClick={handleToggleSubscription}
                className={
                  isSubscribed
                    ? "bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 h-9 text-xs"
                    : "btn-glass-primary h-9 text-xs"
                }
              >
                {loading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                ) : isSubscribed ? (
                  <BellOff className="h-3.5 w-3.5 mr-1.5" />
                ) : (
                  <BellRing className="h-3.5 w-3.5 mr-1.5" />
                )}
                {isSubscribed ? "Disable Push Alerts" : "Enable Push Alerts"}
              </Button>

              {isSubscribed && (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={testing}
                  onClick={handleSendTestPush}
                  className="h-9 px-3 text-xs border-sky-500/30 text-sky-400 hover:text-sky-300 hover:bg-sky-500/10"
                >
                  {testing ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                  ) : (
                    <Send className="h-3.5 w-3.5 mr-1.5" />
                  )}
                  Send Test Alert
                </Button>
              )}
            </div>
          </div>

          {/* Card 2: Progressive Web App (PWA) */}
          <div className="rounded-2xl glass-surface-2 p-4 border border-[var(--border)] space-y-3 flex flex-col justify-between">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 text-cyan-400">
                <Smartphone className="h-4 w-4" />
                <h4 className="font-bold text-sm text-[var(--foreground)]">Install as Native App</h4>
              </div>
              <p className="text-xs text-[var(--muted-foreground)] leading-relaxed">
                Add AeroDrop to your iOS/Android home screen or Windows/Mac dock for instant full-screen radar access without URL bars.
              </p>
            </div>

            <div className="pt-2">
              {isInstalled ? (
                <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-semibold">
                  <CheckCircle2 className="h-4 w-4" />
                  <span>AeroDrop App is installed &amp; standalone active</span>
                </div>
              ) : deferredPrompt ? (
                <Button
                  size="sm"
                  onClick={handleInstallPwa}
                  className="btn-glass-primary h-9 text-xs flex items-center gap-1.5"
                >
                  <Download className="h-3.5 w-3.5" />
                  Install AeroDrop App
                </Button>
              ) : (
                <p className="text-[11px] text-[var(--muted-foreground)]">
                  On Chrome/Edge: Click the install icon in your address bar.<br />
                  On Safari/iOS: Tap <strong className="text-[var(--foreground)]">Share</strong> → <strong className="text-[var(--foreground)]">Add to Home Screen</strong>.
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-sky-500/20 bg-sky-500/5 p-3 text-xs text-[var(--muted-foreground)] flex items-start gap-2.5">
          <Info className="h-4 w-4 text-sky-400 shrink-0 mt-0.5" />
          <div>
            <strong className="text-[var(--foreground)]">Triple-Redundancy Alert Architecture:</strong> AeroDrop now synchronizes your flight price radar across 3 independent channels: <strong>Telegram Bot</strong>, <strong>Custom SMTP Email</strong>, and <strong>Native Browser Push</strong>.
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
