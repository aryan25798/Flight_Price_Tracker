export default function TrackersLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Title & Description Skeleton */}
      <div className="space-y-2">
        <div className="h-7 w-56 rounded-lg bg-[var(--muted)]/50" />
        <div className="h-4 w-96 rounded bg-[var(--muted)]/30" />
      </div>

      {/* Filter / Search Bar Skeleton */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 rounded-2xl glass-surface-1 p-3.5 border border-[var(--border)]">
        <div className="h-9 w-64 rounded-xl bg-[var(--muted)]/30" />
        <div className="flex items-center gap-2">
          <div className="h-9 w-24 rounded-xl bg-[var(--muted)]/30" />
          <div className="h-9 w-28 rounded-xl bg-sky-500/20" />
        </div>
      </div>

      {/* Table Rows Skeleton */}
      <div className="rounded-2xl glass-surface-1 border border-[var(--border)] overflow-hidden">
        <div className="border-b border-[var(--border)] p-4 flex items-center justify-between">
          <div className="h-4 w-32 rounded bg-[var(--muted)]/40" />
          <div className="h-4 w-20 rounded bg-[var(--muted)]/30" />
        </div>
        <div className="divide-y divide-[var(--border)]">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="p-4 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-[var(--muted)]/30" />
                <div className="space-y-1.5">
                  <div className="h-4 w-40 rounded bg-[var(--muted)]/40" />
                  <div className="h-3 w-56 rounded bg-[var(--muted)]/20" />
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="h-5 w-20 rounded bg-[var(--muted)]/30" />
                <div className="h-8 w-24 rounded-xl bg-[var(--muted)]/25" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
