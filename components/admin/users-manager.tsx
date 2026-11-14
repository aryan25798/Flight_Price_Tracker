"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Ban,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Crown,
  Eye,
  Infinity as InfinityIcon,
  Layers,
  Loader2,
  MessageSquare,
  Search,
  Shield,
  ShieldCheck,
  Sliders,
  Sparkles,
  Trash2,
  User,
  X,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { adminActionDispatch, updateUserTierAction } from "@/app/admin/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { PaginationBar } from "@/components/ui/pagination-bar";
import { formatCurrency, formatDateShort } from "@/lib/utils";
import type { Profile, TrackedFlight, UserTier } from "@/types/database";

interface UsersManagerProps {
  users: Profile[];
  total: number;
  page: number;
  pageSize: number;
  currentAdminId: string;
  initialSearch: string;
  initialStatus: "all" | "active" | "banned";
}

export function UsersManager({
  users,
  total,
  page,
  pageSize,
  currentAdminId,
  initialSearch,
  initialStatus,
}: UsersManagerProps) {
  const router = useRouter();
  const [search, setSearch] = React.useState(initialSearch);
  const [status, setStatus] = React.useState<"all" | "active" | "banned">(initialStatus);
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [detailsModal, setDetailsModal] = React.useState<{
    user: Profile;
    trackers: TrackedFlight[];
  } | null>(null);
  const [modalTrackersPage, setModalTrackersPage] = React.useState(1);
  const [confirmAction, setConfirmAction] = React.useState<{
    type: "ban_user" | "unban_user" | "delete_user";
    user: Profile;
  } | null>(null);

  // User Tier & Quota Modal State
  const [tierModal, setTierModal] = React.useState<Profile | null>(null);
  const [selectedTier, setSelectedTier] = React.useState<UserTier>("free");
  const [quotaMode, setQuotaMode] = React.useState<"tier_default" | "custom_limit" | "unlimited">("tier_default");
  const [customLimit, setCustomLimit] = React.useState<number>(10);
  const [tierNotes, setTierNotes] = React.useState<string>("");
  const [isUpdatingTier, setIsUpdatingTier] = React.useState(false);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  function openTierModal(u: Profile) {
    setSelectedTier(u.tier || "free");
    if (u.custom_tracker_limit === -1) {
      setQuotaMode("unlimited");
      setCustomLimit(25);
    } else if (u.custom_tracker_limit !== null && u.custom_tracker_limit !== undefined) {
      setQuotaMode("custom_limit");
      setCustomLimit(u.custom_tracker_limit);
    } else {
      setQuotaMode("tier_default");
      setCustomLimit(u.tier === "pro" ? 25 : 3);
    }
    setTierNotes(u.tier_notes || "");
    setTierModal(u);
  }

  async function handleSaveTier() {
    if (!tierModal) return;
    setIsUpdatingTier(true);
    try {
      let limit: number | null = null;
      if (quotaMode === "unlimited") {
        limit = -1;
      } else if (quotaMode === "custom_limit") {
        limit = Math.max(1, Number(customLimit) || 1);
      } else {
        limit = null; // tier default
      }

      const res = await updateUserTierAction({
        userId: tierModal.id,
        tier: selectedTier,
        customTrackerLimit: limit,
        tierNotes: tierNotes.trim() || null,
      });

      if (!res.ok) {
        toast.error(res.error || "Failed to update user tier");
        return;
      }

      toast.success(`Successfully updated ${tierModal.email} to ${selectedTier.toUpperCase()} plan`);
      setTierModal(null);
      router.refresh();
    } finally {
      setIsUpdatingTier(false);
    }
  }

  function renderTierBadge(tier?: UserTier) {
    switch (tier) {
      case "enterprise":
        return (
          <Badge variant="cyan" dot className="text-[11px] font-semibold border-cyan-500/30">
            Enterprise
          </Badge>
        );
      case "pro":
        return (
          <Badge variant="amber" dot className="text-[11px] font-semibold border-amber-500/30">
            Pro Plan
          </Badge>
        );
      case "free":
      default:
        return (
          <Badge variant="secondary" className="text-[11px]">
            Free Tier
          </Badge>
        );
    }
  }

  function renderQuotaBadge(u: Profile) {
    if (u.custom_tracker_limit === -1 || (u.tier === "enterprise" && u.custom_tracker_limit === null)) {
      return (
        <span className="inline-flex items-center gap-1 font-mono text-xs font-semibold text-emerald-400">
          <InfinityIcon className="h-3.5 w-3.5" />
          <span>Unlimited</span>
        </span>
      );
    }
    const limit = u.custom_tracker_limit !== null && u.custom_tracker_limit !== undefined
      ? u.custom_tracker_limit
      : u.tier === "pro"
        ? 25
        : 3;

    return (
      <span className="font-mono text-xs text-[var(--foreground)]">
        {limit} {limit === 1 ? "Tracker" : "Trackers"}
        {u.custom_tracker_limit !== null && (
          <span className="ml-1 text-[10px] text-amber-400/80 font-sans font-medium">(Custom)</span>
        )}
      </span>
    );
  }

  function applyFilters(e: React.FormEvent) {
    e.preventDefault();
    const qs = new URLSearchParams();
    if (search.trim()) qs.set("search", search.trim());
    if (status !== "all") qs.set("status", status);
    qs.set("page", "1");
    router.push(`/admin/users?${qs.toString()}`);
  }

  function clearSearch() {
    setSearch("");
    const qs = new URLSearchParams();
    if (status !== "all") qs.set("status", status);
    qs.set("page", "1");
    router.push(`/admin/users?${qs.toString()}`);
  }

  async function openDetails(userId: string) {
    setBusyId(userId);
    try {
      const res = await adminActionDispatch({ action: "get_user_details", userId });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      const d = res.data as { user: Profile; trackers: TrackedFlight[] };
      setModalTrackersPage(1);
      setDetailsModal(d);
    } finally {
      setBusyId(null);
    }
  }

  async function executeConfirmAction() {
    if (!confirmAction) return;
    setBusyId(confirmAction.user.id);
    try {
      const res = await adminActionDispatch(
        { action: confirmAction.type, userId: confirmAction.user.id },
        ["/admin", "/admin/users", "/admin/audit-logs"],
      );
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(
        confirmAction.type === "ban_user"
          ? "User banned successfully"
          : confirmAction.type === "unban_user"
            ? "User unbanned successfully"
            : "User permanently deleted",
      );
      setConfirmAction(null);
      router.refresh();
    } finally {
      setBusyId(null);
    }
  }

  function pageLink(p: number) {
    const qs = new URLSearchParams();
    if (initialSearch) qs.set("search", initialSearch);
    if (initialStatus !== "all") qs.set("status", initialStatus);
    qs.set("page", String(p));
    return `/admin/users?${qs.toString()}`;
  }

  return (
    <>
      <div className="space-y-6">
        {/* Header / Summary */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[var(--foreground)]">
              User Directory
            </h1>
            <p className="text-xs sm:text-sm text-[var(--muted-foreground)]">
              Search, inspect, and manage accounts with PostgreSQL trigram indexing.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="font-mono text-xs">
              {total} Total Users
            </Badge>
            <Badge variant="amber" dot className="font-mono text-xs">
              Live DB
            </Badge>
          </div>
        </div>

        {/* Filter Bar */}
        <Card className="glass-panel border-[var(--border)]">
          <CardContent className="p-3.5 sm:p-4">
            <form onSubmit={applyFilters} className="flex flex-col sm:flex-row gap-2.5">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-[var(--muted-foreground)]" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by email (sub-string / trigram)..."
                  className="pl-9 pr-8 h-10 text-sm"
                />
                {search && (
                  <button
                    type="button"
                    onClick={clearSearch}
                    className="absolute right-2.5 top-2.5 text-[var(--muted-foreground)] hover:text-[var(--foreground)] p-0.5 rounded"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
              <div className="flex gap-2">
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as "all" | "active" | "banned")}
                  className="h-10 rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 text-sm text-[var(--foreground)] focus:outline-none focus:ring-1 focus:ring-amber-500 min-w-[130px]"
                >
                  <option value="all">All Statuses</option>
                  <option value="active">Active Only</option>
                  <option value="banned">Banned Only</option>
                </select>
                <Button type="submit" variant="secondary" className="h-10 px-4 shrink-0 font-medium">
                  Filter
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* User Content */}
        {users.length === 0 ? (
          <Card className="glass-panel text-center py-12 px-4">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[var(--muted)] text-[var(--muted-foreground)] mb-3">
              <User className="h-6 w-6" />
            </div>
            <h3 className="text-base font-semibold text-[var(--foreground)]">No users found</h3>
            <p className="text-xs sm:text-sm text-[var(--muted-foreground)] mt-1 max-w-sm mx-auto">
              {search || status !== "all"
                ? "No registered accounts match your current filter criteria."
                : "There are currently no registered users in the database."}
            </p>
          </Card>
        ) : (
          <>
            {/* Mobile View: Card-based (< 768px) */}
            <div className="grid gap-3 md:hidden">
              {users.map((u) => {
                const isSelf = u.id === currentAdminId;
                return (
                  <Card key={u.id} className="glass-panel border-[var(--border)] p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <p className="font-semibold text-sm text-[var(--foreground)] truncate max-w-[220px]">
                            {u.email}
                          </p>
                          {isSelf && (
                            <Badge variant="outline" className="text-[10px] py-0 px-1.5 font-medium text-amber-500 border-amber-500/30">
                              You
                            </Badge>
                          )}
                        </div>
                        <p className="text-[11px] text-[var(--muted-foreground)] mt-0.5">
                          Joined {formatDateShort(u.created_at)}
                        </p>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <Badge
                          variant={u.role === "super_admin" ? "amber" : "secondary"}
                          dot={u.role === "super_admin"}
                          className="text-[11px] capitalize"
                        >
                          {u.role.replace("_", " ")}
                        </Badge>
                        {u.is_banned ? (
                          <Badge variant="destructive" dot className="text-[11px]">
                            Banned
                          </Badge>
                        ) : (
                          <Badge variant="emerald" dot className="text-[11px]">
                            Active
                          </Badge>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-xs text-[var(--muted-foreground)] pt-2 border-t border-[var(--border)]">
                      <div className="flex items-center gap-1.5">
                        <MessageSquare className="h-3.5 w-3.5 text-sky-400" />
                        <span>Telegram:</span>
                        <span className={u.telegram_chat_id ? "text-emerald-500 font-medium" : "text-[var(--muted-foreground)]"}>
                          {u.telegram_chat_id ? "Connected" : "Not Linked"}
                        </span>
                      </div>
                      <span className="font-mono text-[10px] opacity-60 truncate max-w-[100px]">
                        ID: {u.id.slice(0, 8)}...
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs pt-2 border-t border-[var(--border)]">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[var(--muted-foreground)]">Plan:</span>
                        {renderTierBadge(u.tier)}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[var(--muted-foreground)]">Quota:</span>
                        {renderQuotaBadge(u)}
                      </div>
                    </div>

                    {/* Action Bar */}
                    <div className="flex items-center justify-end gap-1.5 pt-1 flex-wrap">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={busyId === u.id}
                        onClick={() => openTierModal(u)}
                        className="h-9 px-2.5 text-xs text-amber-400 hover:text-amber-300 border-amber-500/30 hover:bg-amber-500/10 flex items-center gap-1.5"
                      >
                        <Sliders className="h-3.5 w-3.5" />
                        Tier & Quota
                      </Button>

                      <Button
                        variant="secondary"
                        size="sm"
                        disabled={busyId === u.id}
                        onClick={() => openDetails(u.id)}
                        className="h-9 px-3 text-xs flex items-center gap-1.5"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        Inspect Trackers
                      </Button>

                      {!isSelf && (
                        <>
                          {u.is_banned ? (
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={busyId === u.id}
                              onClick={() => setConfirmAction({ type: "unban_user", user: u })}
                              className="h-9 px-3 text-xs text-emerald-500 hover:text-emerald-400 border-emerald-500/30"
                            >
                              <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                              Unban
                            </Button>
                          ) : (
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={busyId === u.id}
                              onClick={() => setConfirmAction({ type: "ban_user", user: u })}
                              className="h-9 px-3 text-xs text-amber-500 hover:text-amber-400 border-amber-500/30"
                            >
                              <Ban className="h-3.5 w-3.5 mr-1" />
                              Ban
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            disabled={busyId === u.id}
                            onClick={() => setConfirmAction({ type: "delete_user", user: u })}
                            className="h-9 w-9 text-red-500 hover:text-red-400 hover:bg-red-500/10"
                            title="Delete user"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  </Card>
                );
              })}
            </div>

            {/* Desktop View: Sleek Table (>= 768px) */}
            <div className="hidden md:block rounded-xl border border-[var(--border)] bg-[var(--card)] overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-[var(--border)] bg-[var(--muted)]/40 text-[11px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
                      <th className="py-3 px-4">User Email</th>
                      <th className="py-3 px-4">Role</th>
                      <th className="py-3 px-4">Plan Tier</th>
                      <th className="py-3 px-4">Active Quota</th>
                      <th className="py-3 px-4">Account Status</th>
                      <th className="py-3 px-4">Telegram Bot</th>
                      <th className="py-3 px-4">Joined Date</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border)]">
                    {users.map((u) => {
                      const isSelf = u.id === currentAdminId;
                      return (
                        <tr
                          key={u.id}
                          className="hover:bg-[var(--muted)]/30 transition-colors duration-150"
                        >
                          <td className="py-3.5 px-4 font-medium text-[var(--foreground)]">
                            <div className="flex items-center gap-2">
                              <span>{u.email}</span>
                              {isSelf && (
                                <Badge variant="outline" className="text-[10px] py-0 px-1 text-amber-500 border-amber-500/30">
                                  You
                                </Badge>
                              )}
                            </div>
                            <span className="font-mono text-[11px] text-[var(--muted-foreground)]">
                              {u.id}
                            </span>
                          </td>
                          <td className="py-3.5 px-4">
                            <Badge
                              variant={u.role === "super_admin" ? "amber" : "secondary"}
                              dot={u.role === "super_admin"}
                              className="capitalize text-xs"
                            >
                              {u.role.replace("_", " ")}
                            </Badge>
                          </td>
                          <td className="py-3.5 px-4">
                            {renderTierBadge(u.tier)}
                          </td>
                          <td className="py-3.5 px-4 text-xs whitespace-nowrap">
                            {renderQuotaBadge(u)}
                          </td>
                          <td className="py-3.5 px-4">
                            {u.is_banned ? (
                              <Badge variant="destructive" dot className="text-xs">
                                Banned
                              </Badge>
                            ) : (
                              <Badge variant="emerald" dot className="text-xs">
                                Active
                              </Badge>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-xs">
                            {u.telegram_chat_id ? (
                              <span className="inline-flex items-center gap-1.5 text-emerald-500 font-medium">
                                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                Linked ({u.telegram_chat_id})
                              </span>
                            ) : (
                              <span className="text-[var(--muted-foreground)]">Unlinked</span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-xs text-[var(--muted-foreground)] whitespace-nowrap">
                            {formatDateShort(u.created_at)}
                          </td>
                          <td className="py-3.5 px-4 text-right whitespace-nowrap">
                            <div className="inline-flex items-center gap-1">
                              <Button
                                variant="outline"
                                size="sm"
                                title="Manage Subscription Tier & Quota Limits"
                                disabled={busyId === u.id}
                                onClick={() => openTierModal(u)}
                                className="h-8 px-2.5 text-xs text-amber-400 hover:text-amber-300 border-amber-500/30 hover:bg-amber-500/10"
                              >
                                <Sliders className="h-3.5 w-3.5 mr-1" />
                                Tier & Quota
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                title="View User Details & Trackers"
                                disabled={busyId === u.id}
                                onClick={() => openDetails(u.id)}
                                className="h-8 px-2.5 text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                              >
                                <Eye className="h-3.5 w-3.5 mr-1" />
                                Inspect
                              </Button>
                              {!isSelf && (
                                <>
                                  {u.is_banned ? (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      title="Unban User"
                                      disabled={busyId === u.id}
                                      onClick={() =>
                                        setConfirmAction({ type: "unban_user", user: u })
                                      }
                                      className="h-8 px-2.5 text-xs text-emerald-500 hover:text-emerald-400 hover:bg-emerald-500/10"
                                    >
                                      <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                                      Unban
                                    </Button>
                                  ) : (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      title="Ban User"
                                      disabled={busyId === u.id}
                                      onClick={() =>
                                        setConfirmAction({ type: "ban_user", user: u })
                                      }
                                      className="h-8 px-2.5 text-xs text-amber-500 hover:text-amber-400 hover:bg-amber-500/10"
                                    >
                                      <Ban className="h-3.5 w-3.5 mr-1" />
                                      Ban
                                    </Button>
                                  )}
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    title="Permanently Delete User"
                                    disabled={busyId === u.id}
                                    onClick={() =>
                                      setConfirmAction({ type: "delete_user", user: u })
                                    }
                                    className="h-8 w-8 text-red-500 hover:text-red-400 hover:bg-red-500/10"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Pagination Controls */}
            <PaginationBar
              page={page}
              pageSize={pageSize}
              total={total}
              createPageUrl={pageLink}
              itemLabel="users"
            />
          </>
        )}
      </div>

      {/* User Details & Trackers Dialog */}
      <Dialog
        open={Boolean(detailsModal)}
        onOpenChange={(open) => {
          if (!open) setDetailsModal(null);
        }}
        title={detailsModal?.user.email ?? "Account Inspection"}
        description={
          detailsModal
            ? `Role: ${detailsModal.user.role.toUpperCase()} · User ID: ${detailsModal.user.id}`
            : undefined
        }
        maxWidthClass="max-w-2xl"
      >
        {detailsModal && (
          <div className="space-y-4">
            {/* Account Metadata Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 rounded-xl border border-[var(--border)] bg-[var(--muted)]/20 p-3 text-xs">
              <div>
                <p className="text-[var(--muted-foreground)]">Account Status</p>
                <div className="mt-1">
                  {detailsModal.user.is_banned ? (
                    <Badge variant="destructive" dot className="text-[10px]">
                      Banned
                    </Badge>
                  ) : (
                    <Badge variant="emerald" dot className="text-[10px]">
                      Active
                    </Badge>
                  )}
                </div>
              </div>
              <div>
                <p className="text-[var(--muted-foreground)]">Telegram Status</p>
                <p className="mt-1 font-medium text-[var(--foreground)] truncate">
                  {detailsModal.user.telegram_chat_id ? `Linked (${detailsModal.user.telegram_chat_id})` : "Unlinked"}
                </p>
              </div>
              <div>
                <p className="text-[var(--muted-foreground)]">Registration Date</p>
                <p className="mt-1 font-medium text-[var(--foreground)]">
                  {formatDateShort(detailsModal.user.created_at)}
                </p>
              </div>
            </div>

            {/* Flight Trackers Section */}
            <div>
              <div className="flex items-center justify-between pb-2">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
                  Active & Historical Flight Trackers ({detailsModal.trackers.length})
                </h4>
              </div>

              <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                {detailsModal.trackers.length === 0 ? (
                  <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-6 text-center text-xs text-[var(--muted-foreground)]">
                    This user has not configured any flight trackers yet.
                  </div>
                ) : (
                  detailsModal.trackers
                    .slice((modalTrackersPage - 1) * 5, modalTrackersPage * 5)
                    .map((t) => (
                      <div
                        key={t.id}
                        className="flex items-center justify-between rounded-lg border border-[var(--border)] bg-[var(--card)] p-3 text-xs"
                      >
                        <div>
                          <div className="flex items-center gap-1.5 font-bold text-sm text-[var(--foreground)]">
                            <span>{t.origin}</span>
                            <span className="text-[var(--muted-foreground)] font-normal">→</span>
                            <span>{t.destination}</span>
                            <span className="text-xs font-normal text-[var(--muted-foreground)] ml-1">
                              ({formatDateShort(t.departure_date)})
                            </span>
                          </div>
                          <p className="text-[11px] text-[var(--muted-foreground)] mt-0.5">
                            Target: <strong className="text-[var(--foreground)]">{formatCurrency(t.target_price, t.currency)}</strong> · Latest:{" "}
                            <strong className="text-cyan-500 dark:text-cyan-400">{formatCurrency(t.last_seen_price, t.currency)}</strong>
                          </p>
                        </div>
                        <Badge variant={t.is_active ? "emerald" : "secondary"} dot={t.is_active}>
                          {t.is_active ? "Active" : "Paused"}
                        </Badge>
                      </div>
                    ))
                )}
              </div>

              {detailsModal.trackers.length > 5 && (
                <div className="pt-2">
                  <PaginationBar
                    page={modalTrackersPage}
                    pageSize={5}
                    total={detailsModal.trackers.length}
                    onPageChange={setModalTrackersPage}
                    itemLabel="trackers"
                  />
                </div>
              )}
            </div>

            <div className="flex justify-end pt-2 border-t border-[var(--border)]">
              <Button variant="outline" size="sm" onClick={() => setDetailsModal(null)}>
                Close Inspector
              </Button>
            </div>
          </div>
        )}
      </Dialog>

      {/* Confirmation Dialog */}
      <Dialog
        open={Boolean(confirmAction)}
        onOpenChange={(open) => {
          if (!open) setConfirmAction(null);
        }}
        title={
          confirmAction?.type === "delete_user"
            ? "Permanently Delete User Account"
            : confirmAction?.type === "ban_user"
              ? "Ban User from Platform"
              : "Restore User Access"
        }
        description={
          confirmAction
            ? `Are you sure you want to proceed with this action for ${confirmAction.user.email}? This event will be permanently written to the admin audit ledger.`
            : undefined
        }
        maxWidthClass="max-w-md"
      >
        <div className="space-y-4">
          {confirmAction?.type === "delete_user" && (
            <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-500">
              <strong>Warning:</strong> Deleting this account will cascade and permanently remove all associated flight trackers, notification states, and preferences from the database.
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => setConfirmAction(null)}>
              Cancel
            </Button>
            <Button
              variant={confirmAction?.type === "unban_user" ? "default" : "destructive"}
              size="sm"
              disabled={busyId === confirmAction?.user.id}
              onClick={executeConfirmAction}
            >
              {confirmAction?.type === "delete_user"
                ? "Delete Permanently"
                : confirmAction?.type === "ban_user"
                  ? "Confirm Ban"
                  : "Confirm Unban"}
            </Button>
          </div>
        </div>
      </Dialog>

      {/* User Subscription Tier & Quota Control Modal */}
      <Dialog
        open={Boolean(tierModal)}
        onOpenChange={(open) => {
          if (!open) setTierModal(null);
        }}
        title="Subscription Tier & Quota Control"
        description={
          tierModal
            ? `Configure access tier, quota limits, and capacity overrides for ${tierModal.email}`
            : undefined
        }
        maxWidthClass="max-w-xl"
      >
        {tierModal && (
          <div className="space-y-5">
            {/* User Context Banner */}
            <div className="flex items-center justify-between p-3 rounded-xl border border-[var(--border)] bg-[var(--muted)]/20 text-xs">
              <div>
                <p className="text-[var(--muted-foreground)]">Account Target</p>
                <p className="font-semibold text-sm text-[var(--foreground)] mt-0.5">{tierModal.email}</p>
              </div>
              <div className="text-right">
                <p className="text-[var(--muted-foreground)]">Current Tier</p>
                <div className="mt-0.5">{renderTierBadge(tierModal.tier)}</div>
              </div>
            </div>

            {/* Step 1: Select Tier */}
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-[var(--muted-foreground)] flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-amber-400" />
                Select Platform Plan Tier
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                {/* Free */}
                <button
                  type="button"
                  onClick={() => {
                    setSelectedTier("free");
                    if (quotaMode === "tier_default") setCustomLimit(3);
                  }}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                    selectedTier === "free"
                      ? "border-sky-500 bg-sky-500/10 shadow-[0_0_15px_rgba(56,189,248,0.2)]"
                      : "border-[var(--border)] bg-[var(--card)] hover:border-slate-600"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm text-[var(--foreground)]">Free</span>
                    {selectedTier === "free" && <Check className="h-4 w-4 text-sky-400" />}
                  </div>
                  <p className="text-[11px] text-[var(--muted-foreground)] mt-1">
                    Standard 3 trackers · 4h polling
                  </p>
                </button>

                {/* Pro */}
                <button
                  type="button"
                  onClick={() => {
                    setSelectedTier("pro");
                    if (quotaMode === "tier_default") setCustomLimit(25);
                  }}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                    selectedTier === "pro"
                      ? "border-amber-500 bg-amber-500/10 shadow-[0_0_15px_rgba(245,158,11,0.2)]"
                      : "border-[var(--border)] bg-[var(--card)] hover:border-slate-600"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm text-amber-400">Pro Plan</span>
                    {selectedTier === "pro" && <Check className="h-4 w-4 text-amber-400" />}
                  </div>
                  <p className="text-[11px] text-[var(--muted-foreground)] mt-1">
                    25 trackers · Fast alerts · Priority
                  </p>
                </button>

                {/* Enterprise */}
                <button
                  type="button"
                  onClick={() => {
                    setSelectedTier("enterprise");
                    if (quotaMode === "tier_default") setCustomLimit(100);
                  }}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                    selectedTier === "enterprise"
                      ? "border-emerald-500 bg-emerald-500/10 shadow-[0_0_15px_rgba(16,185,129,0.2)]"
                      : "border-[var(--border)] bg-[var(--card)] hover:border-slate-600"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm text-emerald-400">Enterprise</span>
                    {selectedTier === "enterprise" && <Check className="h-4 w-4 text-emerald-400" />}
                  </div>
                  <p className="text-[11px] text-[var(--muted-foreground)] mt-1">
                    Unlimited trackers · Dedicated sync
                  </p>
                </button>
              </div>
            </div>

            {/* Step 2: Quota Enforcement Mode */}
            <div className="space-y-2.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-[var(--muted-foreground)] flex items-center gap-1.5">
                <Sliders className="h-3.5 w-3.5 text-cyan-400" />
                Tracker Quota Capacity Allocation
              </label>

              <div className="space-y-2">
                <label className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                  quotaMode === "tier_default" ? "border-amber-500/40 bg-amber-500/5" : "border-[var(--border)] bg-[var(--card)]"
                }`}>
                  <input
                    type="radio"
                    name="quotaMode"
                    value="tier_default"
                    checked={quotaMode === "tier_default"}
                    onChange={() => setQuotaMode("tier_default")}
                    className="mt-0.5 accent-amber-500"
                  />
                  <div className="text-xs">
                    <p className="font-semibold text-[var(--foreground)]">Tier Default Allocation</p>
                    <p className="text-[var(--muted-foreground)] mt-0.5">
                      Enforce default quota based on selected tier ({selectedTier === "enterprise" ? "Unlimited ∞" : selectedTier === "pro" ? "25 Trackers" : "3 Trackers"}).
                    </p>
                  </div>
                </label>

                <label className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                  quotaMode === "custom_limit" ? "border-amber-500/40 bg-amber-500/5" : "border-[var(--border)] bg-[var(--card)]"
                }`}>
                  <input
                    type="radio"
                    name="quotaMode"
                    value="custom_limit"
                    checked={quotaMode === "custom_limit"}
                    onChange={() => setQuotaMode("custom_limit")}
                    className="mt-0.5 accent-amber-500"
                  />
                  <div className="text-xs flex-1">
                    <p className="font-semibold text-[var(--foreground)]">Custom Tracker Quota</p>
                    <p className="text-[var(--muted-foreground)] mt-0.5">
                      Grant a specific number of concurrent active trackers (e.g. 5, 10, 50, 100).
                    </p>
                    {quotaMode === "custom_limit" && (
                      <div className="mt-2.5 flex items-center gap-2">
                        <Input
                          type="number"
                          min="1"
                          max="10000"
                          value={customLimit}
                          onChange={(e) => setCustomLimit(Math.max(1, parseInt(e.target.value) || 1))}
                          className="w-32 h-9 text-sm font-mono"
                          placeholder="e.g. 15"
                        />
                        <span className="text-xs text-[var(--muted-foreground)]">concurrent active trackers</span>
                      </div>
                    )}
                  </div>
                </label>

                <label className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                  quotaMode === "unlimited" ? "border-emerald-500/40 bg-emerald-500/5" : "border-[var(--border)] bg-[var(--card)]"
                }`}>
                  <input
                    type="radio"
                    name="quotaMode"
                    value="unlimited"
                    checked={quotaMode === "unlimited"}
                    onChange={() => setQuotaMode("unlimited")}
                    className="mt-0.5 accent-emerald-500"
                  />
                  <div className="text-xs">
                    <p className="font-semibold text-emerald-400 flex items-center gap-1.5">
                      <InfinityIcon className="h-3.5 w-3.5" />
                      Unlimited Trackers (∞)
                    </p>
                    <p className="text-[var(--muted-foreground)] mt-0.5">
                      Completely uncapped flight monitoring capacity for VIP or staff accounts.
                    </p>
                  </div>
                </label>
              </div>
            </div>

            {/* Step 3: Admin Notes */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
                Administrative Audit Notes (Optional)
              </label>
              <textarea
                value={tierNotes}
                onChange={(e) => setTierNotes(e.target.value)}
                placeholder="e.g. Upgraded after enterprise contract agreement or partner testing..."
                rows={2}
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--card)] p-2.5 text-xs text-[var(--foreground)] focus:outline-none focus:ring-1 focus:ring-amber-500 resize-none"
              />
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-2 pt-3 border-t border-[var(--border)]">
              <Button
                variant="outline"
                size="sm"
                disabled={isUpdatingTier}
                onClick={() => setTierModal(null)}
              >
                Cancel
              </Button>
              <Button
                variant="default"
                size="sm"
                disabled={isUpdatingTier}
                onClick={handleSaveTier}
                className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-semibold"
              >
                {isUpdatingTier ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                    Saving Changes...
                  </>
                ) : (
                  <>
                    <ShieldCheck className="h-3.5 w-3.5 mr-1.5" />
                    Save Tier & Quota
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </Dialog>
    </>
  );
}
