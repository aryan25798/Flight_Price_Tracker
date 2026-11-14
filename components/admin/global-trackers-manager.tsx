"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Edit3,
  Filter,
  Pause,
  Play,
  RotateCcw,
  Search,
  Trash2,
  TrendingDown,
  User,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { adminActionDispatch } from "@/app/admin/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { PaginationBar } from "@/components/ui/pagination-bar";
import { formatCurrency, formatDateShort } from "@/lib/utils";
import type { TrackedFlight } from "@/types/database";

interface GlobalTracker extends TrackedFlight {
  profiles?: { email: string } | null;
}

interface GlobalTrackersManagerProps {
  trackers: GlobalTracker[];
  total: number;
  page: number;
  pageSize: number;
  initialFilters: {
    email: string;
    origin: string;
    destination: string;
    status: "all" | "active" | "paused";
    departureDate: string;
  };
}

export function GlobalTrackersManager({
  trackers,
  total,
  page,
  pageSize,
  initialFilters,
}: GlobalTrackersManagerProps) {
  const router = useRouter();
  const [email, setEmail] = React.useState(initialFilters.email);
  const [origin, setOrigin] = React.useState(initialFilters.origin);
  const [destination, setDestination] = React.useState(initialFilters.destination);
  const [status, setStatus] = React.useState<"all" | "active" | "paused">(initialFilters.status);
  const [departureDate, setDepartureDate] = React.useState(initialFilters.departureDate);
  const [busyId, setBusyId] = React.useState<string | null>(null);

  const [editTarget, setEditTarget] = React.useState<GlobalTracker | null>(null);
  const [editPrice, setEditPrice] = React.useState("");
  const [editDate, setEditDate] = React.useState("");
  const [deleteTarget, setDeleteTarget] = React.useState<GlobalTracker | null>(null);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  function applyFilters(e: React.FormEvent) {
    e.preventDefault();
    const qs = new URLSearchParams();
    if (email.trim()) qs.set("email", email.trim());
    if (origin.trim()) qs.set("origin", origin.trim().toUpperCase());
    if (destination.trim()) qs.set("destination", destination.trim().toUpperCase());
    if (status !== "all") qs.set("status", status);
    if (departureDate) qs.set("departureDate", departureDate);
    qs.set("page", "1");
    router.push(`/admin/trackers?${qs.toString()}`);
  }

  function resetFilters() {
    setEmail("");
    setOrigin("");
    setDestination("");
    setStatus("all");
    setDepartureDate("");
    router.push("/admin/trackers?page=1");
  }

  async function toggleStatus(t: GlobalTracker) {
    setBusyId(t.id);
    try {
      const res = await adminActionDispatch(
        { action: "update_tracker", trackerId: t.id, isActive: !t.is_active },
        ["/admin", "/admin/trackers", "/admin/audit-logs"],
      );
      if (!res.ok) toast.error(res.error);
      else {
        toast.success(t.is_active ? "Tracker paused" : "Tracker resumed");
        router.refresh();
      }
    } finally {
      setBusyId(null);
    }
  }

  async function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editTarget) return;
    setBusyId(editTarget.id);
    try {
      const res = await adminActionDispatch(
        {
          action: "update_tracker",
          trackerId: editTarget.id,
          targetPrice: Number(editPrice),
          departureDate: editDate,
        },
        ["/admin", "/admin/trackers", "/admin/audit-logs"],
      );
      if (!res.ok) toast.error(res.error);
      else {
        toast.success("Tracker updated successfully");
        setEditTarget(null);
        router.refresh();
      }
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setBusyId(deleteTarget.id);
    try {
      const res = await adminActionDispatch(
        { action: "delete_tracker", trackerId: deleteTarget.id },
        ["/admin", "/admin/trackers", "/admin/audit-logs"],
      );
      if (!res.ok) toast.error(res.error);
      else {
        toast.success("Tracker deleted permanently");
        setDeleteTarget(null);
        router.refresh();
      }
    } finally {
      setBusyId(null);
    }
  }

  function pageLink(p: number) {
    const qs = new URLSearchParams();
    if (initialFilters.email) qs.set("email", initialFilters.email);
    if (initialFilters.origin) qs.set("origin", initialFilters.origin);
    if (initialFilters.destination) qs.set("destination", initialFilters.destination);
    if (initialFilters.status !== "all") qs.set("status", initialFilters.status);
    if (initialFilters.departureDate) qs.set("departureDate", initialFilters.departureDate);
    qs.set("page", String(p));
    return `/admin/trackers?${qs.toString()}`;
  }

  const hasActiveFilters = Boolean(
    initialFilters.email ||
      initialFilters.origin ||
      initialFilters.destination ||
      initialFilters.status !== "all" ||
      initialFilters.departureDate,
  );

  return (
    <>
      <div className="space-y-6">
        {/* Header Section */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[var(--foreground)]">
              Global Flight Trackers
            </h1>
            <p className="text-xs sm:text-sm text-[var(--muted-foreground)]">
              Full cross-tenant visibility across all user route monitoring targets.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="font-mono text-xs">
              {total} Trackers
            </Badge>
            {hasActiveFilters && (
              <Badge variant="amber" className="text-xs">
                Filtered
              </Badge>
            )}
          </div>
        </div>

        {/* Multi-Criteria Filter Bar */}
        <Card className="glass-panel border-[var(--border)]">
          <CardContent className="p-3.5 sm:p-4">
            <form onSubmit={applyFilters} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
                {/* Email Filter */}
                <div className="relative sm:col-span-2 lg:col-span-2">
                  <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-[var(--muted-foreground)]" />
                  <Input
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Filter by user email..."
                    className="pl-9 h-10 text-xs sm:text-sm"
                  />
                </div>

                {/* Origin / Dest Pair */}
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    value={origin}
                    onChange={(e) => setOrigin(e.target.value.toUpperCase())}
                    placeholder="Origin (DEL)"
                    maxLength={3}
                    className="h-10 text-xs sm:text-sm uppercase font-mono"
                  />
                  <Input
                    value={destination}
                    onChange={(e) => setDestination(e.target.value.toUpperCase())}
                    placeholder="Dest (BOM)"
                    maxLength={3}
                    className="h-10 text-xs sm:text-sm uppercase font-mono"
                  />
                </div>

                {/* Status Dropdown */}
                <div>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as "all" | "active" | "paused")}
                    className="h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 text-xs sm:text-sm text-[var(--foreground)] focus:outline-none focus:ring-1 focus:ring-amber-500"
                  >
                    <option value="all">All Statuses</option>
                    <option value="active">Active Only</option>
                    <option value="paused">Paused Only</option>
                  </select>
                </div>

                {/* Departure Date */}
                <div>
                  <Input
                    type="date"
                    value={departureDate}
                    onChange={(e) => setDepartureDate(e.target.value)}
                    className="h-10 text-xs sm:text-sm"
                  />
                </div>
              </div>

              {/* Action Buttons Row */}
              <div className="flex items-center justify-between pt-1 border-t border-[var(--border)]/50">
                <div className="text-[11px] text-[var(--muted-foreground)]">
                  {hasActiveFilters ? "Filtered results active" : "Showing all subscription records"}
                </div>
                <div className="flex items-center gap-2">
                  {hasActiveFilters && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={resetFilters}
                      className="h-8 px-2.5 text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                    >
                      <RotateCcw className="h-3.5 w-3.5 mr-1" />
                      Reset
                    </Button>
                  )}
                  <Button type="submit" variant="secondary" size="sm" className="h-8 px-4 text-xs font-medium">
                    <Filter className="h-3.5 w-3.5 mr-1.5" />
                    Apply Filters
                  </Button>
                </div>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Content Section */}
        {trackers.length === 0 ? (
          <Card className="glass-panel text-center py-12 px-4">
            <h3 className="text-base font-semibold text-[var(--foreground)]">No trackers found</h3>
            <p className="text-xs sm:text-sm text-[var(--muted-foreground)] mt-1 max-w-sm mx-auto">
              {hasActiveFilters
                ? "No subscriptions match the selected criteria. Try relaxing your filters."
                : "No flight trackers have been created across any user account."}
            </p>
          </Card>
        ) : (
          <>
            {/* Mobile View: Ticket Cards (< 768px) */}
            <div className="grid gap-3 md:hidden">
              {trackers.map((t) => (
                <Card key={t.id} className="glass-panel border-[var(--border)] p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-base tracking-tight text-[var(--foreground)]">
                          {t.origin}
                        </span>
                        <ArrowRight className="h-3.5 w-3.5 text-cyan-500" />
                        <span className="font-bold text-base tracking-tight text-[var(--foreground)]">
                          {t.destination}
                        </span>
                      </div>
                      <p className="text-xs text-[var(--muted-foreground)] flex items-center gap-1 mt-0.5">
                        <Calendar className="h-3 w-3" />
                        {formatDateShort(t.departure_date)}
                      </p>
                    </div>

                    <Badge variant={t.is_active ? "emerald" : "secondary"} dot={t.is_active} className="text-xs">
                      {t.is_active ? "Active" : "Paused"}
                    </Badge>
                  </div>

                  {/* Pricing Overview */}
                  <div className="grid grid-cols-2 gap-2 rounded-lg bg-[var(--muted)]/20 p-2.5 text-xs">
                    <div>
                      <span className="text-[var(--muted-foreground)] text-[10px] uppercase font-semibold">
                        Target Alert
                      </span>
                      <p className="font-semibold text-[var(--foreground)]">
                        {formatCurrency(t.target_price, t.currency)}
                      </p>
                    </div>
                    <div>
                      <span className="text-[var(--muted-foreground)] text-[10px] uppercase font-semibold">
                        Latest Seen
                      </span>
                      <p className="font-semibold text-cyan-500 dark:text-cyan-400">
                        {formatCurrency(t.last_seen_price, t.currency)}
                      </p>
                    </div>
                  </div>

                  {/* Owner & Sub Details */}
                  <div className="flex items-center justify-between text-xs text-[var(--muted-foreground)] pt-1 border-t border-[var(--border)]">
                    <span className="flex items-center gap-1 truncate max-w-[190px]">
                      <User className="h-3 w-3 shrink-0" />
                      {t.profiles?.email ?? t.user_id.slice(0, 10)}
                    </span>
                    <span className="font-mono text-[10px] opacity-60">
                      ID: {t.id.slice(0, 6)}...
                    </span>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center justify-end gap-1.5 pt-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setEditTarget(t);
                        setEditPrice(String(t.target_price));
                        setEditDate(t.departure_date);
                      }}
                      className="h-9 px-3 text-xs"
                    >
                      <Edit3 className="h-3.5 w-3.5 mr-1" />
                      Edit
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={busyId === t.id}
                      onClick={() => toggleStatus(t)}
                      className="h-9 px-3 text-xs"
                    >
                      {t.is_active ? (
                        <>
                          <Pause className="h-3.5 w-3.5 mr-1" />
                          Pause
                        </>
                      ) : (
                        <>
                          <Play className="h-3.5 w-3.5 mr-1 text-emerald-500" />
                          Resume
                        </>
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      disabled={busyId === t.id}
                      onClick={() => setDeleteTarget(t)}
                      className="h-9 w-9 text-red-500 hover:text-red-400 hover:bg-red-500/10"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </Card>
              ))}
            </div>

            {/* Desktop View: Sleek Table (>= 768px) */}
            <div className="hidden md:block rounded-xl border border-[var(--border)] bg-[var(--card)] overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-[var(--border)] bg-[var(--muted)]/40 text-[11px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
                      <th className="py-3 px-4">User Account</th>
                      <th className="py-3 px-4">Flight Route</th>
                      <th className="py-3 px-4">Departure</th>
                      <th className="py-3 px-4">Target Alert</th>
                      <th className="py-3 px-4">Latest Price</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border)]">
                    {trackers.map((t) => (
                      <tr
                        key={t.id}
                        className="hover:bg-[var(--muted)]/30 transition-colors duration-150"
                      >
                        <td className="py-3.5 px-4 font-medium text-xs text-[var(--foreground)]">
                          <div className="truncate max-w-[200px]" title={t.profiles?.email ?? t.user_id}>
                            {t.profiles?.email ?? t.user_id}
                          </div>
                          <span className="font-mono text-[10px] text-[var(--muted-foreground)] opacity-60">
                            {t.id}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 font-semibold">
                          <span className="inline-flex items-center gap-1.5 text-xs text-[var(--foreground)]">
                            <span className="font-mono bg-[var(--muted)] px-1.5 py-0.5 rounded text-[11px]">
                              {t.origin}
                            </span>
                            <ArrowRight className="h-3 w-3 text-cyan-500" />
                            <span className="font-mono bg-[var(--muted)] px-1.5 py-0.5 rounded text-[11px]">
                              {t.destination}
                            </span>
                          </span>
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap text-xs text-[var(--muted-foreground)]">
                          {formatDateShort(t.departure_date)}
                        </td>
                        <td className="py-3.5 px-4 font-semibold text-xs tabular-nums text-[var(--foreground)]">
                          {formatCurrency(t.target_price, t.currency)}
                        </td>
                        <td className="py-3.5 px-4 font-semibold text-xs tabular-nums text-cyan-500 dark:text-cyan-400">
                          {formatCurrency(t.last_seen_price, t.currency)}
                        </td>
                        <td className="py-3.5 px-4">
                          <Badge
                            variant={t.is_active ? "emerald" : "secondary"}
                            dot={t.is_active}
                            className="text-xs"
                          >
                            {t.is_active ? "Active" : "Paused"}
                          </Badge>
                        </td>
                        <td className="py-3.5 px-4 text-right whitespace-nowrap">
                          <div className="inline-flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              title="Edit Target Price & Date"
                              onClick={() => {
                                setEditTarget(t);
                                setEditPrice(String(t.target_price));
                                setEditDate(t.departure_date);
                              }}
                              className="h-8 px-2.5 text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                            >
                              <Edit3 className="h-3.5 w-3.5 mr-1" />
                              Edit
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={busyId === t.id}
                              title={t.is_active ? "Pause Monitoring" : "Resume Monitoring"}
                              onClick={() => toggleStatus(t)}
                              className="h-8 px-2.5 text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                            >
                              {t.is_active ? (
                                <>
                                  <Pause className="h-3.5 w-3.5 mr-1" />
                                  Pause
                                </>
                              ) : (
                                <>
                                  <Play className="h-3.5 w-3.5 mr-1 text-emerald-500" />
                                  Resume
                                </>
                              )}
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              disabled={busyId === t.id}
                              title="Delete Tracker Permanently"
                              onClick={() => setDeleteTarget(t)}
                              className="h-8 w-8 text-red-500 hover:text-red-400 hover:bg-red-500/10"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
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
              itemLabel="trackers"
            />
          </>
        )}
      </div>

      {/* Edit Modal */}
      <Dialog
        open={Boolean(editTarget)}
        onOpenChange={(open) => {
          if (!open) setEditTarget(null);
        }}
        title="Edit Subscription Target"
        description={
          editTarget
            ? `Updating route ${editTarget.origin} → ${editTarget.destination} for ${editTarget.profiles?.email ?? editTarget.user_id}`
            : undefined
        }
        maxWidthClass="max-w-md"
      >
        <form onSubmit={handleSaveEdit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[var(--foreground)]">
              Target Price ({editTarget?.currency ?? "INR"})
            </label>
            <Input
              type="number"
              min={1}
              required
              value={editPrice}
              onChange={(e) => setEditPrice(e.target.value)}
              className="h-10 text-sm"
            />
            <p className="text-[11px] text-[var(--muted-foreground)]">
              An alert fires whenever the verified flight price drops below this ceiling.
            </p>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[var(--foreground)]">
              Departure Date
            </label>
            <Input
              type="date"
              required
              value={editDate}
              onChange={(e) => setEditDate(e.target.value)}
              className="h-10 text-sm"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-[var(--border)]">
            <Button type="button" variant="outline" size="sm" onClick={() => setEditTarget(null)}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={busyId === editTarget?.id}>
              Save Changes
            </Button>
          </div>
        </form>
      </Dialog>

      {/* Delete Confirmation Modal */}
      <Dialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title="Delete Flight Subscription"
        description="Are you sure you want to delete this tracker? The user will no longer receive price alerts for this flight route."
        maxWidthClass="max-w-md"
      >
        <div className="space-y-4">
          {deleteTarget && (
            <div className="rounded-lg border border-[var(--border)] bg-[var(--muted)]/20 p-3 text-xs space-y-1">
              <p>
                <strong>Route:</strong> {deleteTarget.origin} → {deleteTarget.destination}
              </p>
              <p>
                <strong>User:</strong> {deleteTarget.profiles?.email ?? deleteTarget.user_id}
              </p>
              <p>
                <strong>Departure:</strong> {formatDateShort(deleteTarget.departure_date)}
              </p>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2 border-t border-[var(--border)]">
            <Button type="button" variant="outline" size="sm" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              disabled={busyId === deleteTarget?.id}
              onClick={handleDelete}
            >
              Delete Tracker
            </Button>
          </div>
        </div>
      </Dialog>
    </>
  );
}
