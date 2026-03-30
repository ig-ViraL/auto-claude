"use client";

import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { useTransition } from "react";
import { useDebounced } from "@/hooks/useDebounced";

type MarketCapTier = "all" | "small" | "mid" | "large";

/**
 * URL-driven filter panel.
 *
 * ALL filter state lives in the URL — no useState for filter values.
 * This means filters survive hard refresh and are fully shareable via URL.
 *
 * Filter choices (see DECISIONS.md for full rationale):
 * 1. % Change — primary daily signal for directional bias
 * 2. Market Cap tier — size segmentation (small/mid/large cap)
 * 3. Max P/E — valuation screen (lower P/E = potentially cheaper)
 *
 * Range inputs are debounced at 400ms to avoid hammering the router
 * on every keystroke while still feeling responsive.
 */
export function FilterPanel({ resultCount }: { resultCount: number }) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  function update(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value === "" || value === "all") {
      params.delete(key);
    } else {
      params.set(key, value);
    }
    startTransition(() => {
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    });
  }

  function clearAll() {
    startTransition(() => {
      router.replace(pathname, { scroll: false });
    });
  }

  const debouncedUpdate = useDebounced(update, 400);

  const minChange = searchParams.get("minChange") ?? "";
  const maxChange = searchParams.get("maxChange") ?? "";
  const marketCap = (searchParams.get("marketCap") as MarketCapTier) ?? "all";
  const maxPE = searchParams.get("maxPE") ?? "";
  const search = searchParams.get("search") ?? "";

  const hasFilters =
    minChange || maxChange || marketCap !== "all" || maxPE || search;

  return (
    <div className={`transition-opacity ${isPending ? "opacity-60" : ""}`}>
      <div className="flex flex-wrap items-end gap-3">
        {/* Search */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-500">Search</label>
          <input
            type="text"
            placeholder="AAPL or Apple…"
            defaultValue={search}
            onChange={(e) => debouncedUpdate("search", e.target.value)}
            className="h-9 w-44 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          />
        </div>

        {/* % Change range */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-500">
            % Change today
          </label>
          <div className="flex items-center gap-1">
            <input
              type="number"
              placeholder="Min"
              defaultValue={minChange}
              step="0.1"
              onChange={(e) => debouncedUpdate("minChange", e.target.value)}
              className="h-9 w-20 rounded-lg border border-slate-200 bg-white px-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
            <span className="text-xs text-slate-400">to</span>
            <input
              type="number"
              placeholder="Max"
              defaultValue={maxChange}
              step="0.1"
              onChange={(e) => debouncedUpdate("maxChange", e.target.value)}
              className="h-9 w-20 rounded-lg border border-slate-200 bg-white px-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>
        </div>

        {/* Market cap tier */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-500">
            Market cap
          </label>
          <select
            value={marketCap}
            onChange={(e) => update("marketCap", e.target.value)}
            className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          >
            <option value="all">All sizes</option>
            <option value="large">Large cap (&gt;$10B)</option>
            <option value="mid">Mid cap ($2B–$10B)</option>
            <option value="small">Small cap (&lt;$2B)</option>
          </select>
        </div>

        {/* Max P/E */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-500">
            Max P/E ratio
          </label>
          <input
            type="number"
            placeholder="e.g. 30"
            defaultValue={maxPE}
            min="0"
            step="1"
            onChange={(e) => debouncedUpdate("maxPE", e.target.value)}
            className="h-9 w-24 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          />
        </div>

        {/* Clear + count */}
        <div className="flex flex-col gap-1 ml-auto items-end">
          <span className="text-xs font-medium text-slate-400">
            {resultCount} stock{resultCount !== 1 ? "s" : ""}
          </span>
          {hasFilters && (
            <button
              onClick={clearAll}
              className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-600 transition hover:border-slate-300 hover:bg-slate-50"
            >
              Clear filters
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
