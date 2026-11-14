"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Bell,
  Check,
  CheckCheck,
  ChevronRight,
  ExternalLink,
  Flame,
  Plane,
  Radio,
  Sparkles,
  TrendingDown,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatRelativeTime } from "@/lib/utils";
import {
  markAllNotificationsAsReadAction,
  markNotificationAsReadAction,
} from "@/app/dashboard/actions";
import { createClient } from "@/lib/supabase/client";
import type { NotificationLog } from "@/types/database";

interface NotificationBellProps {
  initialUnreadCount: number;
}

export function NotificationBell({ initialUnreadCount }: NotificationBellProps) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [unreadCount, setUnreadCount] = React.useState(initialUnreadCount);
  const [notifications, setNotifications] = React.useState<NotificationLog[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [filter, setFilter] = React.useState<"all" | "unread">("all");
  const dropdownRef = React.useRef<HTMLDivElement>(null);

  // Sync with prop updates
  React.useEffect(() => {
    setUnreadCount(initialUnreadCount);
  }, [initialUnreadCount]);

  // Close dropdown on click outside
  React.useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    window.addEventListener("mousedown", handleClickOutside);
    return () => window.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  // Fetch recent notifications when dropdown opens
  React.useEffect(() => {
    if (!open) return;
    async function fetchRecent() {
      setLoading(true);
      try {
        const supabase = createClient();
        const { data, error } = await supabase
          .from("notification_logs")
          .select(`
            id,
            user_id,
            tracker_id,
            route_id,
            notification_type,
            previous_price,
            current_price,
            currency,
            delivery_status,
            sent_at,
            error_message,
            is_read,
            read_at,
            created_at,
            tracked_flights (
              origin,
              destination,
              departure_date,
              target_price,
              currency
            ),
            monitored_routes (
              origin,
              destination,
              last_airline,
              last_booking_url
            )
          `)
          .order("created_at", { ascending: false })
          .limit(8);

        if (!error && data) {
          setNotifications(data as unknown as NotificationLog[]);
          const unread = data.filter((n) => !n.is_read).length;
          setUnreadCount(unread);
        }
      } catch {
        // Silently handle
      } finally {
        setLoading(false);
      }
    }
    fetchRecent();
  }, [open]);

  async function handleMarkAllRead() {
    // Optimistic update
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    setUnreadCount(0);
    try {
      const res = await markAllNotificationsAsReadAction();
      if (res.ok) {
        toast.success("All notifications marked as read");
        router.refresh();
      }
    } catch {
      toast.error("Failed to mark notifications read");
    }
  }

  async function handleMarkSingleRead(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    // Optimistic update
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)),
    );
    setUnreadCount((c) => Math.max(0, c - 1));
    try {
      await markNotificationAsReadAction(id, true);
      router.refresh();
    } catch {
      // Ignore
    }
  }

  const displayedNotifications =
    filter === "unread" ? notifications.filter((n) => !n.is_read) : notifications;

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Button */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="relative rounded-xl p-2 text-[var(--muted-foreground)] hover:bg-[var(--glass-surface-3)] hover:text-[var(--foreground)] transition-all cursor-pointer focus:outline-hidden"
        aria-label="In-app Notifications"
        title="In-app Notifications"
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-black text-white shadow-[0_0_10px_rgba(239,68,68,0.8)] animate-pulse">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {/* Mobile Dimmed Backdrop Overlay */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-xs sm:hidden"
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Floating Glassmorphism Popover Panel */}
      {open && (
        <div className="fixed left-3 right-3 top-16 z-50 sm:static sm:absolute sm:left-auto sm:right-0 sm:top-full sm:mt-2 sm:w-[400px] sm:max-w-[420px] max-h-[calc(100dvh-80px)] sm:max-h-[540px] flex flex-col rounded-2xl glass-floating border border-[var(--border)] shadow-[0_20px_50px_rgba(0,0,0,0.85)] p-0 text-[var(--foreground)] animate-in fade-in zoom-in-95 duration-150 overflow-hidden">
          {/* Header */}
          <div className="shrink-0 flex items-center justify-between border-b border-[var(--border)] px-4 py-3 bg-[var(--glass-surface-2)]/80 backdrop-blur-md">
            <div className="flex items-center gap-2">
              <span className="text-sm font-extrabold tracking-tight">Notifications</span>
              {unreadCount > 0 ? (
                <span className="rounded-full bg-red-500/15 border border-red-500/30 px-2 py-0.5 text-[10px] font-bold text-red-300">
                  {unreadCount} new
                </span>
              ) : (
                <span className="rounded-full bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 text-[10px] font-bold text-emerald-300">
                  All caught up
                </span>
              )}
            </div>

            <div className="flex items-center gap-1.5">
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={handleMarkAllRead}
                  className="flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold text-sky-400 hover:bg-sky-500/15 transition-colors cursor-pointer"
                  title="Mark all as read"
                >
                  <CheckCheck className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Mark all read</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg p-1 text-[var(--muted-foreground)] hover:bg-[var(--glass-surface-3)] hover:text-[var(--foreground)] cursor-pointer"
                aria-label="Close"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* Quick Filter Tabs */}
          <div className="shrink-0 flex items-center gap-2 px-4 py-2 border-b border-[var(--border)] text-xs bg-[var(--glass-surface-1)]">
            <button
              type="button"
              onClick={() => setFilter("all")}
              className={`px-2.5 py-1 rounded-lg font-semibold transition-colors cursor-pointer ${
                filter === "all"
                  ? "bg-sky-500/20 text-sky-300 border border-sky-500/30"
                  : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
              }`}
            >
              All ({notifications.length})
            </button>
            <button
              type="button"
              onClick={() => setFilter("unread")}
              className={`px-2.5 py-1 rounded-lg font-semibold transition-colors cursor-pointer ${
                filter === "unread"
                  ? "bg-sky-500/20 text-sky-300 border border-sky-500/30"
                  : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
              }`}
            >
              Unread ({unreadCount})
            </button>
          </div>

          {/* List Body */}
          <div className="flex-1 overflow-y-auto min-h-0 divide-y divide-[var(--border)] custom-scrollbar">
            {loading ? (
              <div className="py-8 text-center text-xs text-[var(--muted-foreground)] space-y-2">
                <div className="h-5 w-5 rounded-full border-2 border-sky-400 border-t-transparent animate-spin mx-auto" />
                <p>Loading radar notifications...</p>
              </div>
            ) : displayedNotifications.length === 0 ? (
              <div className="py-10 px-4 text-center space-y-2">
                <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-2xl bg-sky-500/10 text-sky-400 border border-sky-500/20">
                  <Check className="h-5 w-5" />
                </div>
                <p className="text-xs font-bold text-[var(--foreground)]">No notifications</p>
                <p className="text-[11px] text-[var(--muted-foreground)] max-w-xs mx-auto">
                  {filter === "unread"
                    ? "You have zero unread alerts. You are completely up to date."
                    : "When fares drop below your alert targets or routines execute, updates appear here."}
                </p>
              </div>
            ) : (
              displayedNotifications.map((n) => {
                const origin =
                  n.tracked_flights?.origin || n.monitored_routes?.origin || "";
                const dest =
                  n.tracked_flights?.destination || n.monitored_routes?.destination || "";
                const routeDisplay =
                  origin && dest
                    ? `${origin} → ${dest}`
                    : origin
                      ? origin
                      : "Flight Radar";
                const isDrop = n.notification_type === "price_drop";
                const savings =
                  n.previous_price && n.current_price
                    ? Math.max(0, n.previous_price - n.current_price)
                    : null;

                return (
                  <div
                    key={n.id}
                    onClick={() => {
                      if (!n.is_read) {
                        handleMarkSingleRead(n.id, { stopPropagation: () => {} } as React.MouseEvent);
                      }
                      if (origin && dest) {
                        setOpen(false);
                        router.push(`/dashboard?origin=${origin}&destination=${dest}`);
                      }
                    }}
                    className={`relative p-3.5 transition-colors cursor-pointer flex items-start gap-3 hover:bg-[var(--glass-surface-2)]/80 ${
                      !n.is_read
                        ? "bg-sky-500/5 border-l-2 border-l-sky-400"
                        : "opacity-85"
                    }`}
                  >
                    {/* Icon */}
                    <div
                      className={`h-8 w-8 rounded-xl shrink-0 flex items-center justify-center border shadow-xs ${
                        isDrop
                          ? "bg-red-500/15 border-red-500/30 text-red-400 shadow-[0_0_10px_rgba(239,68,68,0.25)]"
                          : n.notification_type === "status_update"
                            ? "bg-blue-500/15 border-blue-500/30 text-blue-400"
                            : "bg-sky-500/15 border-sky-500/30 text-sky-400"
                      }`}
                    >
                      {isDrop ? (
                        <Flame className="h-4 w-4" />
                      ) : n.notification_type === "status_update" ? (
                        <Radio className="h-4 w-4" />
                      ) : (
                        <Plane className="h-4 w-4" />
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-extrabold text-[var(--foreground)] truncate">
                          {isDrop
                            ? `Price Drop: ${routeDisplay}`
                            : n.notification_type === "status_update"
                              ? `Status Check: ${routeDisplay}`
                              : `Radar Active: ${routeDisplay}`}
                        </span>
                        <span className="text-[10px] text-[var(--muted-foreground)] shrink-0">
                          {formatRelativeTime(n.created_at)}
                        </span>
                      </div>

                      <p className="text-[11px] text-[var(--muted-foreground)] leading-snug">
                        {isDrop && n.current_price ? (
                          <span>
                            Fares dropped to{" "}
                            <strong className="text-emerald-400 font-mono font-bold">
                              {formatCurrency(n.current_price, n.currency || "INR")}
                            </strong>
                            {savings && savings > 0 && (
                              <span className="text-emerald-300">
                                {" "}
                                (Save {formatCurrency(savings, n.currency || "INR")})
                              </span>
                            )}
                          </span>
                        ) : n.notification_type === "status_update" ? (
                          "4-hour routine heartbeat check completed. Fares remain steady."
                        ) : (
                          "Flight route is actively monitored for price reductions."
                        )}
                      </p>
                    </div>

                    {/* Unread Mark Button */}
                    {!n.is_read && (
                      <button
                        type="button"
                        onClick={(e) => handleMarkSingleRead(n.id, e)}
                        className="h-6 w-6 rounded-lg shrink-0 flex items-center justify-center text-[var(--muted-foreground)] hover:text-sky-400 hover:bg-sky-500/10 transition-colors"
                        title="Mark as read"
                      >
                        <span className="h-2 w-2 rounded-full bg-sky-400 shadow-[0_0_6px_rgba(56,189,248,0.9)]" />
                      </button>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Footer with Link to Full Notification Center */}
          <div className="shrink-0 border-t border-[var(--border)] p-2.5 bg-[var(--glass-surface-2)]/80 text-center">
            <Link
              href="/dashboard/notifications"
              onClick={() => setOpen(false)}
              className="inline-flex items-center justify-center gap-1.5 w-full py-1.5 text-xs font-bold text-sky-400 hover:text-sky-300 transition-colors"
            >
              <span>Open Notification Center</span>
              <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
