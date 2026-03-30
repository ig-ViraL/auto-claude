export function SkeletonTable({ rows = 20 }: { rows?: number }) {
  return (
    <div className="animate-pulse">
      {/* Filter bar skeleton */}
      <div className="mb-4 flex flex-wrap gap-3">
        {[120, 100, 140, 110, 130].map((w, i) => (
          <div
            key={i}
            className="h-9 rounded-lg bg-slate-200"
            style={{ width: w }}
          />
        ))}
      </div>
      {/* Table header skeleton */}
      <div className="mb-2 grid grid-cols-6 gap-4 px-4 py-2">
        {["Ticker", "Price", "% Change", "Market Cap", "P/E", "52W Range"].map(
          (h) => (
            <div key={h} className="h-3 w-16 rounded bg-slate-200" />
          )
        )}
      </div>
      {/* Row skeletons */}
      <div className="divide-y divide-slate-100 rounded-xl border border-slate-100 bg-white">
        {Array.from({ length: rows }).map((_, i) => (
          <div
            key={i}
            className="grid grid-cols-6 items-center gap-4 px-4 py-3"
          >
            <div className="flex flex-col gap-1">
              <div className="h-3.5 w-14 rounded bg-slate-200" />
              <div className="h-3 w-24 rounded bg-slate-100" />
            </div>
            <div className="h-3.5 w-20 rounded bg-slate-200" />
            <div className="h-5 w-16 rounded-full bg-slate-200" />
            <div className="h-3.5 w-16 rounded bg-slate-200" />
            <div className="h-3.5 w-10 rounded bg-slate-200" />
            <div className="h-2 w-full rounded-full bg-slate-200" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function SkeletonDetail() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="flex items-start gap-4">
        <div className="h-12 w-12 rounded-xl bg-slate-200" />
        <div className="space-y-2">
          <div className="h-6 w-48 rounded bg-slate-200" />
          <div className="h-4 w-32 rounded bg-slate-100" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-slate-100 bg-white p-4 space-y-2">
            <div className="h-3 w-20 rounded bg-slate-200" />
            <div className="h-6 w-28 rounded bg-slate-200" />
          </div>
        ))}
      </div>
      <div className="h-24 rounded-xl bg-slate-200" />
    </div>
  );
}
