export default function NotificationsLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Top Banner Skeleton */}
      <div className="rounded-2xl glass-surface-1 p-5 sm:p-7 border border-[var(--border)] space-y-3">
        <div className="h-5 w-36 rounded-full bg-sky-500/10 border border-sky-500/20" />
        <div className="h-7 w-72 rounded-lg bg-[var(--muted)]/50" />
        <div className="h-4 w-96 rounded bg-[var(--muted)]/30" />
      </div>

      {/* Filter Tabs Skeleton */}
      <div className="flex items-center gap-2 border-b border-[var(--border)] pb-3">
        <div className="h-9 w-20 rounded-lg bg-[var(--muted)]/40" />
        <div className="h-9 w-24 rounded-lg bg-[var(--muted)]/30" />
        <div className="h-9 w-28 rounded-lg bg-[var(--muted)]/30" />
      </div>

      {/* Notifications Cards Skeleton */}
      <div className="space-y-3">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="rounded-2xl glass-surface-1 p-4 sm:p-5 border border-[var(--border)] flex items-start gap-3.5"
          >
            <div className="h-11 w-11 rounded-2xl bg-[var(--muted)]/40 shrink-0" />
            <div className="space-y-2 flex-1">
              <div className="h-4 w-60 rounded bg-[var(--muted)]/50" />
              <div className="h-3 w-80 rounded bg-[var(--muted)]/30" />
            </div>
            <div className="h-8 w-24 rounded-xl bg-[var(--muted)]/30" />
          </div>
        ))}
      </div>
    </div>
  );
}
