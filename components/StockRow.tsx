// StockRow is explicitly a Client Component because:
// 1. It handles the img onError event (DOM event handler)
// 2. It's always rendered inside StockTable (a Client Component)
// Being explicit here avoids confusion during code review.
"use client";

import Link from "next/link";
import type { StockData } from "@/lib/types";
import {
  formatPrice,
  formatPercent,
  formatMarketCap,
  formatPE,
} from "@/lib/format";

type Props = {
  stock: StockData;
  /** Flash animation class applied when price updates */
  flashClass: string;
};

/**
 * A single row in the stock screener table.
 * Receives pre-computed flashClass from the parent to indicate a price change.
 * Clicking the row navigates to the detail view (/stock/[ticker]).
 */
export function StockRow({ stock, flashClass }: Props) {
  const isPositive = stock.percentChange >= 0;
  const changeColor = isPositive ? "text-emerald-600" : "text-red-500";
  const changeBg = isPositive ? "bg-emerald-50" : "bg-red-50";

  // 52-week range position (0–100%)
  const rangePercent =
    stock.high52Week && stock.low52Week && stock.high52Week > stock.low52Week
      ? Math.max(
          0,
          Math.min(
            100,
            ((stock.currentPrice - stock.low52Week) /
              (stock.high52Week - stock.low52Week)) *
              100
          )
        )
      : null;

  return (
    <Link
      href={`/stock/${stock.ticker}`}
      className="grid grid-cols-[1fr_1fr_100px_1fr_60px_140px_120px] items-center gap-3 px-4 py-3 transition hover:bg-slate-50 group"
      prefetch={false}
    >
      {/* Ticker + Name */}
      <div className="min-w-0">
        <div className="font-semibold text-sm text-slate-900 group-hover:text-blue-600 transition-colors">
          {stock.ticker}
        </div>
        <div className="text-xs text-slate-500 truncate">{stock.name}</div>
      </div>

      {/* Current Price — flashes on update */}
      <div
        className={`font-mono text-sm font-medium text-slate-900 tabular-nums transition-colors duration-300 ${flashClass}`}
      >
        {formatPrice(stock.currentPrice)}
      </div>

      {/* % Change */}
      <div>
        <span
          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums ${changeBg} ${changeColor}`}
        >
          {formatPercent(stock.percentChange)}
        </span>
      </div>

      {/* Market Cap */}
      <div className="text-sm text-slate-700 tabular-nums">
        {formatMarketCap(stock.marketCapMillions)}
      </div>

      {/* P/E */}
      <div className="text-sm text-slate-700 tabular-nums text-right">
        {formatPE(stock.peRatio)}
      </div>

      {/* 52-Week range bar */}
      <div className="space-y-1">
        <div className="flex justify-between text-[10px] text-slate-400 tabular-nums">
          <span>${stock.low52Week?.toFixed(0) ?? "—"}</span>
          <span>${stock.high52Week?.toFixed(0) ?? "—"}</span>
        </div>
        <div className="relative h-1.5 rounded-full bg-slate-100">
          {rangePercent !== null && (
            <div
              className="absolute top-0 h-1.5 w-1.5 -ml-[3px] rounded-full bg-blue-500 ring-2 ring-white"
              style={{ left: `${rangePercent}%` }}
            />
          )}
        </div>
      </div>

      {/* Industry */}
      <div className="text-xs text-slate-400 truncate hidden xl:block">
        {stock.industry}
      </div>
    </Link>
  );
}
