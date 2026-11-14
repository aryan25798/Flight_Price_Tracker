"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  Bell,
  Check,
  CheckCheck,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Flame,
  Plane,
  Radio,
  Search,
  Sparkles,
  Trash2,
  TrendingDown,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PaginationBar } from "@/components/ui/pagination-bar";
import { formatCurrency, formatDateShort, formatRelativeTime } from "@/lib/utils";
import {
  deleteNotificationAction,
  markAllNotificationsAsReadAction,
  markNotificationAsReadAction,
} from "@/app/dashboard/actions";
import type { NotificationLog } from "@/types/database";

interface NotificationCenterProps {
  notifications: NotificationLog[];
  total: number;
  page: number;
  pageSize: number;
  unreadCount: number;
  priceDropCount: number;
  currentFilter: "all" | "unread" | "price_drop";
}

export function NotificationCenter({
  notifications: initialNotifications,
  total,
  page,
  pageSize,
  unreadCount: initialUnreadCount,
  priceDropCount,
  currentFilter,
}: NotificationCenterProps) {
  const router = useRouter();
  const [notifications, setNotifications] = React.useState<NotificationLog[]>(initialNotifications);
  const [unreadCount, setUnreadCount] = React.useState(initialUnreadCount);
  const [actionLoading, setActionLoading] = React.useState<string | null>(null);

  React.useEffect(() => {
    setNotifications(initialNotifications);
    setUnreadCount(initialUnreadCount);
  }, [initialNotifications, initialUnreadCount]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  async function handleMarkAllAsRead() {
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    setUnreadCount(0);
    try {
      const res = await markAllNotificationsAsReadAction();
      if (res.ok) {
        toast.success("All notifications marked as read");
        router.refresh();
      } else {
        toast.error(res.message);
      }
    } catch {
      toast.error("Failed to mark notifications read");
    }
  }

  async function handleToggleRead(id: string, currentStatus: boolean) {
    const nextStatus = !currentStatus;
    // Optimistic UI update
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, is_read: nextStatus } : n)),
    );
    setUnreadCount((c) => Math.max(0, c + (nextStatus ? -1 : 1)));

    setActionLoading(id);
    try {
      await markNotificationAsReadAction(id, nextStatus);
      router.refresh();
    } catch {
      toast.error("Failed to update status");
    } finally {
      setActionLoading(null);
    }
  }

  async function handleDelete(id: string) {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    setActionLoading(id);
    try {
      const res = await deleteNotificationAction(id);
      if (res.ok) {
        toast.success("Notification removed");
        router.refresh();
      } else {
        toast.error(res.message);
      }
    } catch {
      toast.error("Failed to remove notification");
    } finally {
      setActionLoading(null);
    }
  }

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="relative overflow-hidden rounded-2xl glass-surface-1 p-5 sm:p-7 border border-[var(--border)] shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-sky-500/30 bg-sky-500/10 px-3 py-0.5 text-xs font-semibold text-sky-300">
                <Bell className="h-3.5 w-3.5 text-sky-400" />
                <span>Radar Notification Hub</span>
              </span>
              {unreadCount > 0 && (
                <span className="rounded-full bg-red-500/15 border border-red-500/30 px-2.5 py-0.5 text-xs font-bold text-red-300 animate-pulse">
                  {unreadCount} unread
                </span>
              )}
            </div>
            <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight text-[var(--foreground)]">
              Price Alerts &amp; Flight Updates
            </h2>
            <p className="text-xs sm:text-sm text-[var(--muted-foreground)] leading-relaxed max-w-2xl">
              Inspect verified airline fare drops, 4-hour routine heartbeat summaries, and booking links.
            </p>
          </div>

          {unreadCount > 0 && (
            <Button
              onClick={handleMarkAllAsRead}
              variant="outline"
              size="sm"
              className="gap-2 font-bold text-xs sm:text-sm shadow-xs self-start md:self-auto cursor-pointer border-sky-500/30 hover:border-sky-500/60"
            >
              <CheckCheck className="h-4 w-4 text-sky-400" />
              <span>Mark All as Read</span>
            </Button>
          )}
        </div>
      </div>

      {/* Filter Tabs & Count Badges */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] pb-3">
        <div className="flex items-center gap-2">
          <Link href="/dashboard/notifications?filter=all">
            <Button
              variant={currentFilter === "all" ? "default" : "outline"}
              size="sm"
              className="gap-2 text-xs font-bold cursor-pointer"
            >
              <span>All</span>
              <span className="rounded-full bg-black/20 dark:bg-white/10 px-1.5 py-0.2 text-[10px]">
                {total}
              </span>
            </Button>
          </Link>

          <Link href="/dashboard/notifications?filter=unread">
            <Button
              variant={currentFilter === "unread" ? "default" : "outline"}
              size="sm"
              className="gap-2 text-xs font-bold cursor-pointer"
            >
              <span>Unread</span>
              <span className="rounded-full bg-black/20 dark:bg-white/10 px-1.5 py-0.2 text-[10px]">
                {unreadCount}
              </span>
            </Button>
          </Link>

          <Link href="/dashboard/notifications?filter=price_drop">
            <Button
              variant={currentFilter === "price_drop" ? "default" : "outline"}
              size="sm"
              className="gap-2 text-xs font-bold cursor-pointer"
            >
              <Flame className="h-3.5 w-3.5 text-amber-400" />
              <span>Price Drops</span>
              <span className="rounded-full bg-black/20 dark:bg-white/10 px-1.5 py-0.2 text-[10px]">
                {priceDropCount}
              </span>
            </Button>
          </Link>
        </div>

        <div className="text-xs text-[var(--muted-foreground)]">
          Page {page} of {totalPages} ({total} total)
        </div>
      </div>

      {/* Notifications List */}
      {notifications.length === 0 ? (
        <Card className="glass-surface-1 border-[var(--border)] p-12 text-center shadow-lg">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-sky-500/10 text-sky-400 border border-sky-500/20 mb-4 shadow-[0_0_20px_rgba(56,189,248,0.2)]">
            <CheckCheck className="h-7 w-7" />
          </div>
          <h3 className="text-base sm:text-lg font-bold text-[var(--foreground)]">
            No notifications in this view
          </h3>
          <p className="mt-1 text-xs sm:text-sm text-[var(--muted-foreground)] max-w-md mx-auto">
            {currentFilter === "unread"
              ? "All your notifications have been marked as read. Check back after the next 4-hour radar cycle."
              : "When price drops occur or scheduled 4-hour radar checks run, notifications will be archived here."}
          </p>
          {currentFilter !== "all" && (
            <div className="mt-5">
              <Link href="/dashboard/notifications?filter=all">
                <Button variant="outline" size="sm" className="font-semibold text-xs">
                  View All Notifications
                </Button>
              </Link>
            </div>
          )}
        </Card>
      ) : (
        <div className="space-y-3">
          {notifications.map((n) => {
            const isPriceDrop = n.notification_type === "price_drop";
            const origin =
              n.tracked_flights?.origin || n.monitored_routes?.origin || "Route";
            const destination =
              n.tracked_flights?.destination || n.monitored_routes?.destination || "";
            const depDate =
              n.tracked_flights?.departure_date || "";
            const airline = n.monitored_routes?.last_airline;
            const bookingUrl = n.monitored_routes?.last_booking_url;
            const savings =
              n.previous_price && n.current_price
                ? Math.max(0, n.previous_price - n.current_price)
                : null;
            const discountPct =
              n.previous_price && savings && n.previous_price > 0
                ? Math.round((savings / n.previous_price) * 100)
                : null;

            return (
              <div
                key={n.id}
                className={`relative overflow-hidden rounded-2xl border transition-all p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                  !n.is_read
                    ? "glass-surface-2 border-sky-500/35 shadow-[0_4px_25px_rgba(56,189,248,0.1)] border-l-4 border-l-sky-400"
                    : "glass-surface-1 border-[var(--border)] opacity-85 hover:opacity-100"
                }`}
              >
                <div className="flex items-start gap-3.5 min-w-0">
                  {/* Status Icon */}
                  <div
                    className={`h-11 w-11 rounded-2xl shrink-0 flex items-center justify-center border shadow-xs ${
                      isPriceDrop
                        ? "bg-red-500/15 border-red-500/35 text-red-400 shadow-[0_0_15px_rgba(239,68,68,0.3)]"
                        : n.notification_type === "status_update"
                          ? "bg-blue-500/15 border-blue-500/30 text-blue-400 shadow-[0_0_12px_rgba(59,130,246,0.2)]"
                          : "bg-sky-500/15 border-sky-500/30 text-sky-400"
                    }`}
                  >
                    {isPriceDrop ? (
                      <Flame className="h-5 w-5" />
                    ) : n.notification_type === "status_update" ? (
                      <Radio className="h-5 w-5" />
                    ) : (
                      <Plane className="h-5 w-5" />
                    )}
                  </div>

                  {/* Body Info */}
                  <div className="space-y-1.5 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-extrabold text-sm sm:text-base tracking-tight text-[var(--foreground)]">
                        {isPriceDrop
                          ? `🚨 Price Drop Alert: ${origin} → ${destination}`
                          : n.notification_type === "status_update"
                            ? `4-Hour Status Update: ${origin} → ${destination}`
                            : `Radar Monitoring: ${origin} → ${destination}`}
                      </span>

                      {!n.is_read && (
                        <span className="rounded-full bg-sky-400/20 border border-sky-400/40 px-2 py-0.5 text-[10px] font-bold text-sky-300 shadow-2xs">
                          NEW
                        </span>
                      )}

                      <span className="text-[11px] text-[var(--muted-foreground)]">
                        · {formatRelativeTime(n.created_at)}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 text-xs text-[var(--muted-foreground)]">
                      {depDate && (
                        <span>
                          📅 Departure: <strong>{formatDateShort(depDate)}</strong>
                        </span>
                      )}
                      {airline && (
                        <span>
                          🛫 Airline: <strong>{airline}</strong>
                        </span>
                      )}
                      {n.current_price && (
                        <span className="inline-flex items-center gap-1.5 font-mono">
                          <span>Latest Fare:</span>
                          <strong className="text-emerald-400 text-sm font-extrabold">
                            {formatCurrency(n.current_price, n.currency || "INR")}
                          </strong>
                          {n.previous_price && n.previous_price > n.current_price && (
                            <span className="line-through text-[var(--muted-foreground)] text-xs">
                              {formatCurrency(n.previous_price, n.currency || "INR")}
                            </span>
                          )}
                          {discountPct && discountPct > 0 && (
                            <span className="rounded-md bg-emerald-500/15 border border-emerald-500/30 px-1.5 py-0.5 text-[10px] font-bold text-emerald-300">
                              ↓ {discountPct}% drop
                            </span>
                          )}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right Actions */}
                <div className="flex flex-wrap items-center gap-2 md:shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-[var(--border)]">
                  {bookingUrl && bookingUrl.startsWith("https://") && (
                    <a
                      href={bookingUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 px-3 py-1.5 text-xs font-bold transition-all shadow-xs"
                    >
                      <span>Book Fare</span>
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )}

                  {origin !== "Route" && destination && (
                    <Link href={`/dashboard?origin=${origin}&destination=${destination}`}>
                      <Button variant="outline" size="sm" className="h-8 text-xs font-bold gap-1">
                        <Search className="h-3 w-3" />
                        <span>Compare Fares</span>
                      </Button>
                    </Link>
                  )}

                  <Button
                    onClick={() => handleToggleRead(n.id, n.is_read)}
                    variant="ghost"
                    size="sm"
                    className="h-8 text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                    disabled={actionLoading === n.id}
                  >
                    {n.is_read ? "Mark Unread" : "Mark Read"}
                  </Button>

                  <Button
                    onClick={() => handleDelete(n.id)}
                    variant="ghost"
                    size="iconSm"
                    className="h-8 w-8 text-[var(--muted-foreground)] hover:text-red-400 hover:bg-red-500/10"
                    title="Delete notification"
                    disabled={actionLoading === n.id}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Server-Side Pagination Bar */}
      {total > 0 && (
        <PaginationBar
          page={page}
          pageSize={pageSize}
          total={total}
          createPageUrl={(p) =>
            `/dashboard/notifications?page=${p}&filter=${currentFilter}&pageSize=${pageSize}`
          }
          pageSizeOptions={[10, 25, 50]}
          onPageSizeChange={(newSize) => {
            router.push(
              `/dashboard/notifications?page=1&filter=${currentFilter}&pageSize=${newSize}`,
            );
          }}
          itemLabel="alerts"
        />
      )}
    </div>
  );
}
