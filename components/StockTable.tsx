"use client";

import { useSearchParams } from "next/navigation";
import { useState, useCallback, useRef } from "react";
import type { StockData } from "@/lib/types";
import { MARKET_CAP_TIERS } from "@/lib/types";
import { TICKERS } from "@/lib/stocks";
import { useStockWebSocket, type PriceUpdate } from "@/hooks/useStockWebSocket";
import { FilterPanel } from "./FilterPanel";
import { StockRow } from "./StockRow";
import { ConnectionStatus } from "./ConnectionStatus";

type Props = {
  initialStocks: StockData[];
};

type WsStatus = "connecting" | "connected" | "reconnecting" | "disconnected";

/**
 * Main screener table — client component.
 *
 * STATE DESIGN:
 * - `stocks` Map: keyed by ticker, holds full StockData including latest price
 * - `flashMap` Map: keyed by ticker, holds CSS class for price flash animation
 * - Filter values come from URL (via useSearchParams) — no useState for filters
 *
 * WEBSOCKET BATCHING:
 * The WS hook accumulates trade messages in a ref and calls onBatchUpdate
 * every 500ms. We then do a single setState per batch — not per trade.
 * This keeps renders under control even during high-frequency price feeds.
 */
export function StockTable({ initialStocks }: Props) {
  const searchParams = useSearchParams();
  const [wsStatus, setWsStatus] = useState<WsStatus>("connecting");

  // Main data store: Map for O(1) ticker lookup on updates
  const [stocks, setStocks] = useState<Map<string, StockData>>(
    () => new Map(initialStocks.map((s) => [s.ticker, s]))
  );

  // Flash animation state: ticker → "flash-up" | "flash-down" | ""
  const [flashMap, setFlashMap] = useState<Map<string, string>>(new Map());
  const flashTimeouts = useRef<Map<string, ReturnType<typeof setTimeout>>>(
    new Map()
  );

  const onBatchUpdate = useCallback((updates: Map<string, PriceUpdate>) => {
    setStocks((prev) => {
      const next = new Map(prev);
      const newFlash = new Map<string, string>();

      updates.forEach(({ ticker, currentPrice }) => {
        const existing = next.get(ticker);
        if (!existing) return;

        const prev_price = existing.currentPrice;
        if (Math.abs(currentPrice - prev_price) < 0.001) return; // no meaningful change

        const percentChange =
          existing.previousClose > 0
            ? ((currentPrice - existing.previousClose) /
                existing.previousClose) *
              100
            : existing.percentChange;

        next.set(ticker, { ...existing, currentPrice, percentChange });
        newFlash.set(
          ticker,
          currentPrice > prev_price ? "text-emerald-500" : "text-red-500"
        );
      });

      if (newFlash.size > 0) {
        setFlashMap((prev) => {
          const m = new Map(prev);
          newFlash.forEach((cls, ticker) => {
            // Clear any existing timeout for this ticker
            clearTimeout(flashTimeouts.current.get(ticker));
            m.set(ticker, cls);
            // Remove flash after 800ms
            flashTimeouts.current.set(
              ticker,
              setTimeout(() => {
                setFlashMap((fm) => {
                  const n = new Map(fm);
                  n.delete(ticker);
                  return n;
                });
              }, 800)
            );
          });
          return m;
        });
      }

      return next;
    });
  }, []);

  useStockWebSocket({
    tickers: TICKERS,
    onBatchUpdate,
    onStatusChange: setWsStatus,
  });

  // --- Filtering (client-side, from URL params) ---
  const search = (searchParams.get("search") ?? "").toLowerCase();
  const minChange = parseFloat(searchParams.get("minChange") ?? "");
  const maxChange = parseFloat(searchParams.get("maxChange") ?? "");
  const marketCap = searchParams.get("marketCap") ?? "all";
  const maxPE = parseFloat(searchParams.get("maxPE") ?? "");

  const allStocks = Array.from(stocks.values());

  const filtered = allStocks.filter((s) => {
    if (
      search &&
      !s.ticker.toLowerCase().includes(search) &&
      !s.name.toLowerCase().includes(search)
    )
      return false;

    if (!isNaN(minChange) && s.percentChange < minChange) return false;
    if (!isNaN(maxChange) && s.percentChange > maxChange) return false;

    if (marketCap === "large" && s.marketCapMillions < MARKET_CAP_TIERS.large.min)
      return false;
    if (
      marketCap === "mid" &&
      (s.marketCapMillions < MARKET_CAP_TIERS.mid.min ||
        s.marketCapMillions >= MARKET_CAP_TIERS.mid.max)
    )
      return false;
    if (marketCap === "small" && s.marketCapMillions >= MARKET_CAP_TIERS.small.max)
      return false;

    if (!isNaN(maxPE)) {
      if (s.peRatio === null || s.peRatio <= 0 || s.peRatio > maxPE)
        return false;
    }

    return true;
  });

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <FilterPanel resultCount={filtered.length} />

      {/* Table */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        {/* Header */}
        <div className="grid grid-cols-[1fr_1fr_100px_1fr_60px_140px_120px] gap-3 border-b border-slate-100 px-4 py-2.5">
          {["Ticker", "Price", "% Change", "Mkt Cap", "P/E", "52-Week Range", "Industry"].map(
            (h) => (
              <div key={h} className="text-xs font-semibold uppercase tracking-wide text-slate-400 last:hidden xl:last:block">
                {h}
              </div>
            )
          )}
        </div>

        {/* Rows */}
        <div className="divide-y divide-slate-100">
          {filtered.length === 0 ? (
            <div className="px-4 py-12 text-center text-sm text-slate-400">
              No stocks match the current filters.
            </div>
          ) : (
            filtered.map((stock) => (
              <StockRow
                key={stock.ticker}
                stock={stock}
                flashClass={flashMap.get(stock.ticker) ?? ""}
              />
            ))
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between text-xs text-slate-400">
        <ConnectionStatus status={wsStatus} />
        <span>
          {filtered.length} of {allStocks.length} stocks ·{" "}
          {wsStatus === "connected" ? "Prices updating live" : "Connecting to feed…"}
        </span>
      </div>
    </div>
  );
}
