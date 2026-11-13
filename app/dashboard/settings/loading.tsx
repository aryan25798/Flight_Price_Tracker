export default function SettingsLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Title & Description Skeleton */}
      <div className="space-y-2">
        <div className="h-7 w-64 rounded-lg bg-[var(--muted)]/50" />
        <div className="h-4 w-96 rounded bg-[var(--muted)]/30" />
      </div>

      {/* Telegram Card Skeleton */}
      <div className="rounded-2xl glass-surface-1 p-5 sm:p-7 border border-[var(--border)] space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-sky-500/20" />
            <div className="space-y-1">
              <div className="h-5 w-44 rounded bg-[var(--muted)]/50" />
              <div className="h-3.5 w-60 rounded bg-[var(--muted)]/30" />
            </div>
          </div>
          <div className="h-8 w-24 rounded-full bg-[var(--muted)]/30" />
        </div>
        <div className="h-20 rounded-xl bg-[var(--muted)]/20 border border-[var(--border)]" />
      </div>

      {/* Account Details Card Skeleton */}
      <div className="rounded-2xl glass-surface-1 p-5 sm:p-7 border border-[var(--border)] space-y-4">
        <div className="h-5 w-36 rounded bg-[var(--muted)]/50" />
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="h-16 rounded-xl bg-[var(--muted)]/20" />
          <div className="h-16 rounded-xl bg-[var(--muted)]/20" />
          <div className="h-16 rounded-xl bg-[var(--muted)]/20" />
        </div>
      </div>
    </div>
  );
}
