import { Suspense } from "react";
import { fetchAllStocks } from "@/lib/finnhub";
import { TICKERS } from "@/lib/stocks";
import { StockTable } from "@/components/StockTable";
import { SkeletonTable } from "@/components/SkeletonTable";

/**
 * RENDERING STRATEGY: Dynamic (no 'use cache' on this page)
 *
 * The main screener page must be fully dynamic because:
 * 1. Stock quotes must be fresh on every request — stale prices mislead analysts
 * 2. URL search params (filter state) are runtime-only data
 *
 * The page shell (header, filter bar chrome) is static and included in the
 * prerendered HTML. ScreenerContent streams in via Suspense at request time.
 *
 * Company profiles and metrics ARE cached (in fetchProfile/fetchMetrics via
 * 'use cache') — those don't need to be fresh per request.
 */

export default function Page() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Stock Screener</h1>
        <p className="mt-1 text-sm text-slate-500">
          20 stocks · Live prices via Finnhub WebSocket · Filter, share, analyse
        </p>
      </div>

      {/* Suspense boundary: fallback is the static skeleton, content streams at request time */}
      <Suspense fallback={<SkeletonTable rows={20} />}>
        <ScreenerContent />
      </Suspense>
    </div>
  );
}

/**
 * Server component — fetches initial data before streaming HTML to the client.
 * Quotes are fresh; profiles and metrics are served from 'use cache'.
 *
 * Wrapped in Suspense above so the skeleton shows instantly while this
 * component awaits the Finnhub API responses.
 */
async function ScreenerContent() {
  const stocks = await fetchAllStocks(TICKERS);

  return (
    /**
     * StockTable is a Client Component that:
     * 1. Receives initial data as props (server → client boundary)
     * 2. Opens a WebSocket and subscribes to all tickers
     * 3. Reads filter state from URL via useSearchParams
     * 4. Renders the table with live price updates
     *
     * Wrapping in Suspense again here because StockTable uses useSearchParams,
     * which requires a Suspense boundary in Next.js 16.
     */
    <Suspense fallback={<SkeletonTable rows={20} />}>
      <StockTable initialStocks={stocks} />
    </Suspense>
  );
}
