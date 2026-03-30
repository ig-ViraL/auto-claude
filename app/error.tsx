"use client";

import { useEffect } from "react";

/**
 * Route-level error boundary for the main screener page.
 * Catches errors from ScreenerContent (e.g. Finnhub API down at startup).
 * Shows a recoverable error state — the user can retry without a full page reload.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[Screener] Page error:", error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
      <div className="text-4xl">⚠️</div>
      <h2 className="text-xl font-semibold text-slate-800">
        Could not load stock data
      </h2>
      <p className="max-w-sm text-sm text-slate-500">
        {error.message?.includes("FINNHUB_API_KEY")
          ? "FINNHUB_API_KEY is not configured. Add it to .env.local and restart the server."
          : "There was a problem connecting to the market data provider. This may be a temporary Finnhub API issue."}
      </p>
      <button
        onClick={reset}
        className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700"
      >
        Try again
      </button>
    </div>
  );
}
