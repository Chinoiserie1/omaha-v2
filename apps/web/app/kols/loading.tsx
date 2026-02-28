export default function KolsLoading() {
  return (
    <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <div className="mb-6 h-8 w-48 animate-pulse rounded bg-zinc-200" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="rounded-lg border border-zinc-200 p-4"
          >
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 animate-pulse rounded-full bg-zinc-200" />
              <div className="space-y-2">
                <div className="h-4 w-28 animate-pulse rounded bg-zinc-200" />
                <div className="h-3 w-20 animate-pulse rounded bg-zinc-200" />
              </div>
            </div>
            <div className="mt-3 flex gap-4">
              <div className="h-3 w-24 animate-pulse rounded bg-zinc-200" />
              <div className="h-3 w-20 animate-pulse rounded bg-zinc-200" />
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
