"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Code2,
  FileText,
  Globe,
  Search,
  ShieldAlert,
  User,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PaginationBar } from "@/components/ui/pagination-bar";

interface AuditLogRow {
  id: string;
  admin_id: string | null;
  action: string;
  target_id: string | null;
  metadata: Record<string, unknown>;
  ip_address: string | null;
  created_at: string;
  profiles?: { email: string } | null;
}

interface AuditLogsViewerProps {
  logs: AuditLogRow[];
  total: number;
  page: number;
  pageSize: number;
  initialSearch: string;
}

export function AuditLogsViewer({
  logs,
  total,
  page,
  pageSize,
  initialSearch,
}: AuditLogsViewerProps) {
  const router = useRouter();
  const [search, setSearch] = React.useState(initialSearch);
  const [expandedId, setExpandedId] = React.useState<string | null>(null);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    const qs = new URLSearchParams();
    if (search.trim()) qs.set("search", search.trim());
    qs.set("page", "1");
    router.push(`/admin/audit-logs?${qs.toString()}`);
  }

  function clearSearch() {
    setSearch("");
    router.push("/admin/audit-logs?page=1");
  }

  function pageLink(p: number) {
    const qs = new URLSearchParams();
    if (initialSearch) qs.set("search", initialSearch);
    qs.set("page", String(p));
    return `/admin/audit-logs?${qs.toString()}`;
  }

  const getActionBadgeVariant = (action: string) => {
    if (action.includes("delete") || action.includes("ban")) return "destructive";
    if (action.includes("update") || action.includes("settings")) return "amber";
    if (action.includes("trigger") || action.includes("poll")) return "cyan";
    return "secondary";
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[var(--foreground)]">
            Audit Ledger
          </h1>
          <p className="text-xs sm:text-sm text-[var(--muted-foreground)]">
            Cryptographically anchored record of all superuser actions, mutations, and security events.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="font-mono text-xs">
            {total} Entries
          </Badge>
          <Badge variant="emerald" dot className="text-xs">
            Immutable
          </Badge>
        </div>
      </div>

      {/* Search Input Bar */}
      <Card className="glass-panel border-[var(--border)]">
        <CardContent className="p-3.5 sm:p-4">
          <form onSubmit={handleSearch} className="flex gap-2">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-[var(--muted-foreground)]" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search action name or target ID..."
                className="pl-9 pr-8 h-10 text-xs sm:text-sm"
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
            <Button type="submit" variant="secondary" className="h-10 px-4 text-xs sm:text-sm font-medium">
              Search
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Logs View */}
      {logs.length === 0 ? (
        <Card className="glass-panel text-center py-12 px-4">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[var(--muted)] text-[var(--muted-foreground)] mb-3">
            <FileText className="h-6 w-6" />
          </div>
          <h3 className="text-base font-semibold text-[var(--foreground)]">No audit records found</h3>
          <p className="text-xs sm:text-sm text-[var(--muted-foreground)] mt-1 max-w-sm mx-auto">
            {search
              ? "No ledger events match your search query."
              : "No administrative operations have been logged yet."}
          </p>
        </Card>
      ) : (
        <>
          {/* Mobile View: Cards (< 768px) */}
          <div className="grid gap-3 md:hidden">
            {logs.map((log) => {
              const isExpanded = expandedId === log.id;
              return (
                <Card
                  key={log.id}
                  className="glass-panel border-[var(--border)] p-4 space-y-3 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant={getActionBadgeVariant(log.action)} className="font-mono text-[11px]">
                        {log.action}
                      </Badge>
                      <span className="text-[11px] text-[var(--muted-foreground)]">
                        {new Date(log.created_at).toLocaleString([], {
                          dateStyle: "short",
                          timeStyle: "short",
                        })}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-[10px] uppercase font-semibold text-[var(--muted-foreground)] flex items-center gap-1">
                        <User className="h-2.5 w-2.5" />
                        Admin
                      </span>
                      <p className="font-medium text-[var(--foreground)] truncate">
                        {log.profiles?.email ?? log.admin_id ?? "System"}
                      </p>
                    </div>

                    <div>
                      <span className="text-[10px] uppercase font-semibold text-[var(--muted-foreground)] flex items-center gap-1">
                        <Globe className="h-2.5 w-2.5" />
                        Client IP
                      </span>
                      <p className="font-mono text-[11px] text-[var(--muted-foreground)]">
                        {log.ip_address ?? "—"}
                      </p>
                    </div>
                  </div>

                  {log.target_id && (
                    <div className="text-xs border-t border-[var(--border)] pt-2">
                      <span className="text-[10px] uppercase font-semibold text-[var(--muted-foreground)]">
                        Target Resource ID
                      </span>
                      <p className="font-mono text-[11px] text-[var(--foreground)] truncate">
                        {log.target_id}
                      </p>
                    </div>
                  )}

                  {/* Expand JSON Metadata */}
                  <div className="pt-1 border-t border-[var(--border)]">
                    <button
                      type="button"
                      onClick={() => setExpandedId(isExpanded ? null : log.id)}
                      className="w-full flex items-center justify-between text-xs font-medium text-[var(--muted-foreground)] hover:text-[var(--foreground)] py-1"
                    >
                      <span className="flex items-center gap-1.5">
                        <Code2 className="h-3.5 w-3.5 text-cyan-500" />
                        {isExpanded ? "Hide Metadata" : "Inspect Metadata Payload"}
                      </span>
                      <ChevronDown
                        className={`h-4 w-4 transition-transform duration-200 ${
                          isExpanded ? "rotate-180" : ""
                        }`}
                      />
                    </button>

                    {isExpanded && (
                      <div className="mt-2 rounded-lg border border-[var(--border)] bg-[var(--muted)]/30 p-2.5 overflow-hidden">
                        <pre className="font-mono text-[11px] text-[var(--foreground)] overflow-x-auto max-h-56 p-1">
                          {JSON.stringify(log.metadata ?? {}, null, 2)}
                        </pre>
                      </div>
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
                    <th className="py-3 px-3 w-8" />
                    <th className="py-3 px-4">Action</th>
                    <th className="py-3 px-4">Admin Actor</th>
                    <th className="py-3 px-4">Target Resource</th>
                    <th className="py-3 px-4">Client IP</th>
                    <th className="py-3 px-4 text-right">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {logs.map((log) => {
                    const isExpanded = expandedId === log.id;
                    return (
                      <React.Fragment key={log.id}>
                        <tr
                          className="hover:bg-[var(--muted)]/30 cursor-pointer transition-colors duration-150"
                          onClick={() => setExpandedId(isExpanded ? null : log.id)}
                        >
                          <td className="py-3.5 px-3">
                            <ChevronDown
                              className={`h-4 w-4 text-[var(--muted-foreground)] transition-transform duration-200 ${
                                isExpanded ? "rotate-0" : "-rotate-90"
                              }`}
                            />
                          </td>
                          <td className="py-3.5 px-4">
                            <Badge
                              variant={getActionBadgeVariant(log.action)}
                              className="font-mono text-xs font-semibold"
                            >
                              {log.action}
                            </Badge>
                          </td>
                          <td className="py-3.5 px-4 text-xs font-medium text-[var(--foreground)]">
                            {log.profiles?.email ?? log.admin_id ?? "System Scheduler"}
                          </td>
                          <td className="py-3.5 px-4 font-mono text-xs text-[var(--muted-foreground)]">
                            {log.target_id ? (
                              <span className="truncate max-w-[180px] inline-block" title={log.target_id}>
                                {log.target_id}
                              </span>
                            ) : (
                              "—"
                            )}
                          </td>
                          <td className="py-3.5 px-4 font-mono text-xs text-[var(--muted-foreground)]">
                            {log.ip_address ?? "—"}
                          </td>
                          <td className="py-3.5 px-4 text-right text-xs text-[var(--muted-foreground)] whitespace-nowrap">
                            {new Date(log.created_at).toLocaleString([], {
                              dateStyle: "short",
                              timeStyle: "medium",
                            })}
                          </td>
                        </tr>

                        {isExpanded && (
                          <tr className="bg-[var(--muted)]/20 border-b border-[var(--border)]">
                            <td colSpan={6} className="p-4">
                              <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 shadow-inner space-y-2">
                                <div className="flex items-center justify-between text-xs text-[var(--muted-foreground)] border-b border-[var(--border)]/60 pb-2">
                                  <span className="flex items-center gap-1.5 font-semibold text-[var(--foreground)]">
                                    <Code2 className="h-4 w-4 text-cyan-500" />
                                    Metadata Payload (Immutable JSON)
                                  </span>
                                  <span className="font-mono text-[10px]">
                                    Entry ID: {log.id}
                                  </span>
                                </div>
                                <pre className="font-mono text-xs text-[var(--foreground)] overflow-x-auto max-h-72 p-2">
                                  {JSON.stringify(log.metadata ?? {}, null, 2)}
                                </pre>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
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
            itemLabel="audit logs"
          />
        </>
      )}
    </div>
  );
}
