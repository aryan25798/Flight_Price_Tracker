export default function RootLoading() {
  return (
    <div className="min-h-screen ambient-night-mesh flex flex-col items-center justify-center p-6 text-center">
      <div className="relative flex flex-col items-center gap-4">
        {/* Glow radar spinner */}
        <div className="relative flex h-16 w-16 items-center justify-center">
          <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-sky-400 to-blue-600 opacity-40 blur-xl animate-pulse" />
          <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-900/90 border border-sky-500/30 shadow-[0_0_25px_rgba(56,189,248,0.35)]">
            <svg
              className="h-7 w-7 text-sky-400 animate-spin"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
          </div>
        </div>

        <div className="space-y-1">
          <p className="text-sm font-semibold tracking-wide text-sky-300">
            AeroDrop Radar
          </p>
          <p className="text-xs text-[var(--muted-foreground)]">
            Syncing live flight intelligence...
          </p>
        </div>
      </div>
    </div>
  );
}
