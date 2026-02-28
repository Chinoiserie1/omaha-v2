export default function KolDetailLoading() {
  return (
    <main className="mx-auto max-w-4xl space-y-8 px-4 py-10 sm:px-6">
      {/* Header skeleton */}
      <div className="flex items-start gap-4">
        <div className="h-16 w-16 animate-pulse rounded-full bg-zinc-200" />
        <div className="space-y-2">
          <div className="h-6 w-40 animate-pulse rounded bg-zinc-200" />
          <div className="h-4 w-24 animate-pulse rounded bg-zinc-200" />
          <div className="h-4 w-64 animate-pulse rounded bg-zinc-200" />
        </div>
      </div>

      {/* Backtest skeleton */}
      <div>
        <div className="mb-3 h-5 w-40 animate-pulse rounded bg-zinc-200" />
        <div className="grid gap-4 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="rounded-lg border border-zinc-200 p-4">
              <div className="h-4 w-20 animate-pulse rounded bg-zinc-200" />
              <div className="mt-2 h-6 w-24 animate-pulse rounded bg-zinc-200" />
            </div>
          ))}
        </div>
      </div>

      {/* Portfolio skeleton */}
      <div>
        <div className="mb-3 h-5 w-24 animate-pulse rounded bg-zinc-200" />
        <div className="h-4 w-full animate-pulse rounded bg-zinc-200" />
        <div className="mt-3 space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-10 w-full animate-pulse rounded bg-zinc-100" />
          ))}
        </div>
      </div>

      {/* Tweets skeleton */}
      <div>
        <div className="mb-3 h-5 w-36 animate-pulse rounded bg-zinc-200" />
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="rounded-lg border border-zinc-200 p-4">
              <div className="mb-2 h-4 w-32 animate-pulse rounded bg-zinc-200" />
              <div className="h-12 w-full animate-pulse rounded bg-zinc-200" />
              <div className="mt-2 h-3 w-48 animate-pulse rounded bg-zinc-200" />
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
