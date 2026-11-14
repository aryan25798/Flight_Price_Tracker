"use client";

import * as React from "react";
import Link from "next/link";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  MoreHorizontal,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface PaginationBarProps {
  page: number;
  pageSize: number;
  total: number;
  createPageUrl?: (page: number) => string;
  onPageChange?: (page: number) => void;
  pageSizeOptions?: number[];
  onPageSizeChange?: (pageSize: number) => void;
  className?: string;
  itemLabel?: string;
}

export function PaginationBar({
  page,
  pageSize,
  total,
  createPageUrl,
  onPageChange,
  pageSizeOptions,
  onPageSizeChange,
  className,
  itemLabel = "entries",
}: PaginationBarProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.min(Math.max(1, page), totalPages);

  const startItem = total === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, total);

  // Generate page numbers with ellipses
  const pageNumbers = React.useMemo(() => {
    const pages: (number | "ellipsis")[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
      return pages;
    }

    // Always include page 1
    pages.push(1);

    if (currentPage > 3) {
      pages.push("ellipsis");
    }

    const start = Math.max(2, currentPage - 1);
    const end = Math.min(totalPages - 1, currentPage + 1);

    for (let i = start; i <= end; i++) {
      pages.push(i);
    }

    if (currentPage < totalPages - 2) {
      pages.push("ellipsis");
    }

    // Always include last page
    pages.push(totalPages);

    return pages;
  }, [currentPage, totalPages]);

  const renderPageButton = (p: number, isActive: boolean) => {
    const button = (
      <Button
        variant={isActive ? "default" : "outline"}
        size="sm"
        disabled={isActive}
        onClick={!createPageUrl && !isActive ? () => onPageChange?.(p) : undefined}
        className={cn(
          "h-8 min-w-8 px-2.5 text-xs font-semibold tabular-nums transition-all cursor-pointer",
          isActive
            ? "bg-sky-500 hover:bg-sky-500 text-slate-950 font-bold shadow-[0_0_12px_rgba(56,189,248,0.35)] cursor-default"
            : "border-[var(--border)] bg-[var(--card)] hover:border-sky-500/40 hover:text-sky-300",
        )}
        aria-label={`Page ${p}`}
        aria-current={isActive ? "page" : undefined}
      >
        {p}
      </Button>
    );

    if (createPageUrl && !isActive) {
      return (
        <Link key={p} href={createPageUrl(p)} scroll={false}>
          {button}
        </Link>
      );
    }

    return <React.Fragment key={p}>{button}</React.Fragment>;
  };

  const renderNavButton = (
    key: string,
    targetPage: number,
    icon: React.ReactNode,
    label: string,
    isDisabled: boolean,
  ) => {
    const button = (
      <Button
        variant="outline"
        size="sm"
        disabled={isDisabled}
        onClick={!createPageUrl && !isDisabled ? () => onPageChange?.(targetPage) : undefined}
        className={cn(
          "h-8 px-2.5 text-xs font-semibold gap-1 transition-all",
          isDisabled
            ? "opacity-40 cursor-not-allowed border-[var(--border)]"
            : "cursor-pointer border-[var(--border)] hover:border-sky-500/40 hover:text-sky-300",
        )}
        aria-label={label}
        title={label}
      >
        {icon}
        <span className="hidden sm:inline">{label}</span>
      </Button>
    );

    if (createPageUrl && !isDisabled) {
      return (
        <Link key={key} href={createPageUrl(targetPage)} scroll={false}>
          {button}
        </Link>
      );
    }

    return <React.Fragment key={key}>{button}</React.Fragment>;
  };

  return (
    <nav
      role="navigation"
      aria-label="Pagination"
      className={cn(
        "flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-[var(--border)] text-xs text-[var(--muted-foreground)]",
        className,
      )}
    >
      {/* Left: Entries Counter & Page Size Selector */}
      <div className="flex flex-wrap items-center gap-2.5">
        <div>
          Showing <strong className="text-[var(--foreground)] tabular-nums">{startItem}</strong>–
          <strong className="text-[var(--foreground)] tabular-nums">{endItem}</strong> of{" "}
          <strong className="text-[var(--foreground)] tabular-nums">{total}</strong> {itemLabel}
        </div>

        {pageSizeOptions && pageSizeOptions.length > 1 && onPageSizeChange && (
          <div className="flex items-center gap-1.5 ml-1">
            <span className="text-[11px] text-[var(--muted-foreground)]">per page:</span>
            <select
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              className="h-7 rounded-lg border border-[var(--border)] bg-[var(--card)] px-1.5 text-xs text-[var(--foreground)] focus:outline-none focus:ring-1 focus:ring-sky-500 cursor-pointer"
            >
              {pageSizeOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Right: Interactive Navigation Controls */}
      <div className="flex items-center gap-1 sm:gap-1.5">
        {/* First Page (Only on larger sets) */}
        {totalPages > 4 &&
          renderNavButton(
            "first",
            1,
            <ChevronsLeft className="h-3.5 w-3.5" />,
            "First",
            currentPage <= 1,
          )}

        {/* Previous Page */}
        {renderNavButton(
          "prev",
          currentPage - 1,
          <ChevronLeft className="h-3.5 w-3.5" />,
          "Prev",
          currentPage <= 1,
        )}

        {/* Desktop Numeric Pills */}
        <div className="hidden sm:flex items-center gap-1">
          {pageNumbers.map((p, idx) => {
            if (p === "ellipsis") {
              return (
                <div
                  key={`ellipsis-${idx}`}
                  className="flex h-8 w-8 items-center justify-center text-[var(--muted-foreground)] opacity-60"
                >
                  <MoreHorizontal className="h-3.5 w-3.5" />
                </div>
              );
            }
            return renderPageButton(p, p === currentPage);
          })}
        </div>

        {/* Mobile Compact Page Indicator */}
        <div className="sm:hidden px-2 font-mono font-bold text-xs text-[var(--foreground)]">
          {currentPage} / {totalPages}
        </div>

        {/* Next Page */}
        {renderNavButton(
          "next",
          currentPage + 1,
          <ChevronRight className="h-3.5 w-3.5" />,
          "Next",
          currentPage >= totalPages,
        )}

        {/* Last Page (Only on larger sets) */}
        {totalPages > 4 &&
          renderNavButton(
            "last",
            totalPages,
            <ChevronsRight className="h-3.5 w-3.5" />,
            "Last",
            currentPage >= totalPages,
          )}
      </div>
    </nav>
  );
}
