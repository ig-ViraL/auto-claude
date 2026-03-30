import { Suspense } from "react";
import { notFound } from "next/navigation";
import Link from "next/link";
import { fetchStockData } from "@/lib/finnhub";
import { TICKERS } from "@/lib/stocks";
import {
  formatPrice,
  formatPercent,
  formatMarketCap,
  formatPE,
  formatDate,
} from "@/lib/format";
import { InsightPanel } from "@/components/InsightPanel";
import { SkeletonDetail } from "@/components/SkeletonTable";

/**
 * RENDERING STRATEGY: Dynamic (no 'use cache' on the page itself)
 *
 * The detail page is dynamic for the same reason as the main screener —
 * the quote must be fresh. However, profile and metrics are served from
 * 'use cache' (via fetchProfile and fetchMetrics helpers), so only the
 * quote triggers a live Finnhub API call on each visit.
 *
 * The URL /stock/[ticker] is shareable and fully reproducible.
 *
 * We do NOT use generateStaticParams here because prices are live data —
 * pre-generating static pages would mean stale prices at build time.
 */

type Props = {
  params: Promise<{ ticker: string }>;
};

export async function generateMetadata({ params }: Props) {
  const { ticker } = await params;
  return {
    title: `${ticker.toUpperCase()} — Stock Screener`,
  };
}

export default async function StockDetailPage({ params }: Props) {
  const { ticker } = await params;
  const upperTicker = ticker.toUpperCase();

  if (!(TICKERS as readonly string[]).includes(upperTicker)) {
    notFound();
  }

  return (
    <Suspense fallback={<SkeletonDetail />}>
      <DetailContent ticker={upperTicker} />
    </Suspense>
  );
}

async function DetailContent({ ticker }: { ticker: string }) {
  const stock = await fetchStockData(ticker);

  const isPositive = stock.percentChange >= 0;
  const changeColor = isPositive ? "text-emerald-600" : "text-red-500";
  const changeBg = isPositive ? "bg-emerald-50" : "bg-red-50";

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
    <div className="space-y-6">
      {/* Breadcrumb */}
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 transition-colors"
      >
        <ArrowLeftIcon />
        Back to screener
      </Link>

      {/* Company header */}
      <div className="flex items-start gap-4">
        {stock.logo && (
          // eslint-disable-next-line @next/next/no-img-element
          // Using <img> here because Finnhub logo URLs are external CDN URLs
          // with unknown dimensions — next/image requires explicit width/height
          // for external sources, and logos are small enough that optimization
          // provides negligible benefit.
          <img
            src={stock.logo}
            alt={`${stock.name} logo`}
            className="h-12 w-12 rounded-xl border border-slate-100 bg-white object-contain p-1"
            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
          />
        )}
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-bold text-slate-900">{stock.name}</h1>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-sm font-mono font-medium text-slate-600">
              {stock.ticker}
            </span>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
              {stock.exchange}
            </span>
          </div>
          <p className="mt-0.5 text-sm text-slate-500">
            {stock.industry} · {stock.country}
            {stock.ipo ? ` · IPO ${formatDate(stock.ipo)}` : ""}
          </p>
        </div>
      </div>

      {/* Price hero */}
      <div className="flex items-end gap-4 rounded-2xl border border-slate-200 bg-white p-6">
        <div>
          <div className="text-4xl font-bold font-mono tabular-nums text-slate-900">
            {formatPrice(stock.currentPrice)}
          </div>
          <div className="mt-1 flex items-center gap-2">
            <span
              className={`rounded-full px-2.5 py-1 text-sm font-semibold ${changeBg} ${changeColor}`}
            >
              {formatPercent(stock.percentChange)} today
            </span>
            <span className="text-sm text-slate-400">
              Previous close: {formatPrice(stock.previousClose)}
            </span>
          </div>
        </div>
      </div>

      {/* Metrics grid */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <MetricCard
          label="Market Cap"
          value={formatMarketCap(stock.marketCapMillions)}
          subtext={
            stock.marketCapMillions >= 10_000
              ? "Large cap"
              : stock.marketCapMillions >= 2_000
                ? "Mid cap"
                : "Small cap"
          }
        />
        <MetricCard
          label="P/E Ratio"
          value={formatPE(stock.peRatio)}
          subtext="Trailing P/E"
        />
        <MetricCard
          label="52W High"
          value={stock.high52Week ? formatPrice(stock.high52Week) : "—"}
          subtext={
            stock.priceVs52wHigh !== null
              ? `${formatPercent(stock.priceVs52wHigh)} from high`
              : undefined
          }
          subtextColor={
            stock.priceVs52wHigh !== null && stock.priceVs52wHigh >= 0
              ? "text-emerald-600"
              : "text-red-500"
          }
        />
        <MetricCard
          label="52W Low"
          value={stock.low52Week ? formatPrice(stock.low52Week) : "—"}
          subtext="Annual low"
        />
        <MetricCard
          label="Day High"
          value={formatPrice(stock.dayHigh)}
          subtext="Today's high"
        />
        <MetricCard
          label="Day Low"
          value={formatPrice(stock.dayLow)}
          subtext="Today's low"
        />
        <MetricCard
          label="Open"
          value={formatPrice(stock.openPrice)}
          subtext="Today's open"
        />
        <MetricCard
          label="Beta"
          value={stock.beta !== null ? stock.beta.toFixed(2) : "—"}
          subtext="Market sensitivity"
        />
      </div>

      {/* 52-week range bar */}
      {rangePercent !== null && (
        <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-3">
          <h2 className="text-sm font-semibold text-slate-700">
            52-Week Range Position
          </h2>
          <div className="relative">
            <div className="flex justify-between text-xs text-slate-500 mb-2">
              <span>Low: {formatPrice(stock.low52Week!)}</span>
              <span className="font-medium text-blue-600">
                Current: {formatPrice(stock.currentPrice)}{" "}
                ({rangePercent.toFixed(0)}% of range)
              </span>
              <span>High: {formatPrice(stock.high52Week!)}</span>
            </div>
            <div className="h-3 rounded-full bg-gradient-to-r from-red-100 via-yellow-100 to-emerald-100 relative">
              <div
                className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 h-4 w-4 rounded-full bg-blue-500 ring-2 ring-white shadow"
                style={{ left: `${rangePercent}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Additional info */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {stock.dividendYieldAnnual !== null && (
          <MetricCard
            label="Dividend Yield"
            value={`${(stock.dividendYieldAnnual * 100).toFixed(2)}%`}
            subtext="Annual indicated yield"
          />
        )}
        {stock.revenueGrowthTTMYoy !== null && (
          <MetricCard
            label="Revenue Growth (YoY)"
            value={formatPercent(stock.revenueGrowthTTMYoy * 100)}
            subtext="Trailing twelve months"
            subtextColor={
              stock.revenueGrowthTTMYoy >= 0 ? "text-emerald-600" : "text-red-500"
            }
          />
        )}
        {stock.webUrl && (
          <div className="rounded-xl border border-slate-100 bg-white p-4">
            <div className="text-xs font-medium text-slate-400">Website</div>
            <a
              href={stock.webUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 text-sm font-medium text-blue-600 hover:underline break-all"
            >
              {stock.webUrl.replace(/^https?:\/\//, "")}
            </a>
          </div>
        )}
      </div>

      {/* AI Insight */}
      <div className="rounded-xl border border-violet-100 bg-violet-50/50 p-5 space-y-3">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-slate-700">AI Analyst Insight</h2>
          <span className="rounded-full bg-violet-100 px-2 py-0.5 text-xs text-violet-600">
            Powered by Claude
          </span>
        </div>
        <InsightPanel stock={stock} />
      </div>
    </div>
  );
}

function MetricCard({
  label,
  value,
  subtext,
  subtextColor = "text-slate-400",
}: {
  label: string;
  value: string;
  subtext?: string;
  subtextColor?: string;
}) {
  return (
    <div className="rounded-xl border border-slate-100 bg-white p-4">
      <div className="text-xs font-medium text-slate-400">{label}</div>
      <div className="mt-1 text-lg font-semibold font-mono tabular-nums text-slate-900">
        {value}
      </div>
      {subtext && (
        <div className={`mt-0.5 text-xs ${subtextColor}`}>{subtext}</div>
      )}
    </div>
  );
}

function ArrowLeftIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M19 12H5M12 5l-7 7 7 7" />
    </svg>
  );
}
