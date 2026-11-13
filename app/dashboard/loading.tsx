export default function DashboardLoading() {
  return (
    <div className="space-y-6 sm:space-y-8 animate-pulse">
      {/* Top Banner Skeleton */}
      <div className="relative overflow-hidden rounded-2xl glass-surface-1 p-5 sm:p-7 border border-[var(--border)]">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div className="space-y-3">
            <div className="flex items-center gap-2.5">
              <div className="h-5 w-28 rounded-full bg-sky-500/10 border border-sky-500/20" />
              <div className="h-4 w-36 rounded bg-[var(--muted)]/40" />
            </div>
            <div className="h-7 w-64 rounded-lg bg-[var(--muted)]/50" />
            <div className="h-4 w-80 rounded bg-[var(--muted)]/30" />
          </div>
          <div className="h-10 w-44 rounded-xl bg-sky-500/15 border border-sky-500/20" />
        </div>
      </div>

      {/* 4 Stat Cards Skeleton */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="rounded-2xl glass-surface-1 p-4 sm:p-5 border border-[var(--border)] space-y-3"
          >
            <div className="flex items-center justify-between">
              <div className="h-3.5 w-20 rounded bg-[var(--muted)]/40" />
              <div className="h-8 w-8 rounded-xl bg-[var(--muted)]/30" />
            </div>
            <div className="h-7 w-16 rounded-md bg-[var(--muted)]/60" />
            <div className="h-3 w-28 rounded bg-[var(--muted)]/30" />
          </div>
        ))}
      </div>

      {/* Flight Search Panel Skeleton */}
      <div className="rounded-2xl glass-surface-1 p-5 sm:p-7 border border-[var(--border)] space-y-5">
        <div className="space-y-1.5">
          <div className="h-5 w-48 rounded bg-[var(--muted)]/50" />
          <div className="h-3.5 w-72 rounded bg-[var(--muted)]/30" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="h-14 rounded-xl bg-[var(--muted)]/20 border border-[var(--border)]" />
          <div className="h-14 rounded-xl bg-[var(--muted)]/20 border border-[var(--border)]" />
          <div className="h-14 rounded-xl bg-[var(--muted)]/20 border border-[var(--border)]" />
          <div className="h-14 rounded-xl bg-[var(--muted)]/20 border border-[var(--border)]" />
        </div>
        <div className="flex justify-end pt-2">
          <div className="h-12 w-48 rounded-xl bg-sky-500/20" />
        </div>
      </div>

      {/* Trackers Table Skeleton */}
      <div className="rounded-2xl glass-surface-1 p-5 sm:p-6 border border-[var(--border)] space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <div className="h-5 w-40 rounded bg-[var(--muted)]/50" />
            <div className="h-3.5 w-56 rounded bg-[var(--muted)]/30" />
          </div>
          <div className="h-8 w-24 rounded-lg bg-[var(--muted)]/30" />
        </div>
        <div className="space-y-2.5 pt-2">
          {[1, 2, 3].map((row) => (
            <div
              key={row}
              className="h-16 rounded-xl bg-[var(--muted)]/15 border border-[var(--border)]"
            />
          ))}
        </div>
      </div>
    </div>
  );
}
