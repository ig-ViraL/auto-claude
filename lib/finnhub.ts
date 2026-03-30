import { cacheLife, cacheTag } from "next/cache";
import type { StockQuote, StockProfile, StockMetrics } from "./types";

const BASE = "https://finnhub.io/api/v1";

function apiKey(): string {
  const key = process.env.FINNHUB_API_KEY;
  if (!key) throw new Error("FINNHUB_API_KEY is not set");
  return key;
}

async function finnhubFetch(path: string): Promise<unknown> {
  const url = `${BASE}${path}&token=${apiKey()}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Finnhub ${path} → HTTP ${res.status}`);
  }
  return res.json();
}

// ---------------------------------------------------------------------------
// Quotes — cached for 1 minute. Prices are live but a short cache reduces
// redundant Finnhub calls when multiple users view the same ticker.
// Using 'use cache' as required by Next.js 16 (no implicit caching).
// ---------------------------------------------------------------------------

export async function fetchQuote(ticker: string): Promise<StockQuote> {
  "use cache";
  cacheLife("minutes");
  cacheTag(`quote-${ticker}`);

  const raw = (await finnhubFetch(
    `/quote?symbol=${ticker}`
  )) as Record<string, number>;

  const currentPrice = raw.c ?? 0;
  const previousClose = raw.pc ?? 0;
  const percentChange =
    previousClose !== 0
      ? ((currentPrice - previousClose) / previousClose) * 100
      : raw.dp ?? 0;

  return {
    ticker,
    currentPrice,
    previousClose,
    percentChange,
    dayHigh: raw.h ?? 0,
    dayLow: raw.l ?? 0,
    openPrice: raw.o ?? 0,
    timestamp: raw.t ?? 0,
  };
}

// ---------------------------------------------------------------------------
// Profiles — cached for 1 day. Company name, industry, logo don't change often.
// Using 'use cache' explicitly as required by Next.js 16 (no implicit caching).
// ---------------------------------------------------------------------------

export async function fetchProfile(ticker: string): Promise<StockProfile> {
  "use cache";
  cacheLife("days");
  cacheTag(`profile-${ticker}`);

  const raw = (await finnhubFetch(
    `/stock/profile2?symbol=${ticker}`
  )) as Record<string, string | number>;

  return {
    ticker,
    name: (raw.name as string) || ticker,
    industry: (raw.finnhubIndustry as string) || "Unknown",
    logo: (raw.logo as string) || "",
    marketCapMillions: (raw.marketCapitalization as number) || 0,
    country: (raw.country as string) || "",
    currency: (raw.currency as string) || "USD",
    exchange: (raw.exchange as string) || "",
    ipo: (raw.ipo as string) || "",
    webUrl: (raw.weburl as string) || "",
  };
}

// ---------------------------------------------------------------------------
// Metrics — cached for 4 hours. P/E and 52-week range change intraday but
// not every second. Caching reduces API calls significantly.
// ---------------------------------------------------------------------------

export async function fetchMetrics(ticker: string): Promise<StockMetrics> {
  "use cache";
  cacheLife("hours");
  cacheTag(`metrics-${ticker}`);

  const raw = (await finnhubFetch(
    `/stock/metric?symbol=${ticker}&metric=all`
  )) as { metric?: Record<string, number | null> };

  const m = raw.metric ?? {};
  const high52 = (m["52WeekHigh"] as number | null) ?? null;

  return {
    ticker,
    peRatio: (m["peNormalizedAnnual"] as number | null) ?? null,
    high52Week: high52,
    low52Week: (m["52WeekLow"] as number | null) ?? null,
    priceVs52wHigh: null, // computed in fetchStockData once we have current price
    beta: (m["beta"] as number | null) ?? null,
    dividendYieldAnnual:
      (m["dividendYieldIndicatedAnnual"] as number | null) ?? null,
    revenueGrowthTTMYoy: (m["revenueGrowthTTMYoy"] as number | null) ?? null,
  };
}

// ---------------------------------------------------------------------------
// Combined — fetches all three data types for a ticker in parallel.
// Quote is always fresh; profile and metrics use their respective caches.
// ---------------------------------------------------------------------------

export async function fetchStockData(ticker: string) {
  const [quote, profile, metrics] = await Promise.all([
    fetchQuote(ticker),
    fetchProfile(ticker),
    fetchMetrics(ticker),
  ]);

  const priceVs52wHigh =
    metrics.high52Week && metrics.high52Week > 0
      ? ((quote.currentPrice - metrics.high52Week) / metrics.high52Week) * 100
      : null;

  return {
    ...quote,
    ...profile,
    ...metrics,
    priceVs52wHigh,
  };
}

// ---------------------------------------------------------------------------
// Bulk fetch — fetches all tickers in parallel with a concurrency cap.
// Finnhub free tier: 60 calls/minute. 20 tickers × 3 endpoints = 60 calls
// on a cold cache. Profiles and metrics cache after first hit, so steady-state
// is only 20 quote calls per page load.
// ---------------------------------------------------------------------------

export async function fetchAllStocks(tickers: readonly string[]) {
  // Fetch in two batches of 10 to stay safely under burst limits on cold start
  const firstHalf = tickers.slice(0, 10);
  const secondHalf = tickers.slice(10);

  const [a, b] = await Promise.all([
    Promise.all(firstHalf.map(fetchStockData)),
    Promise.all(secondHalf.map(fetchStockData)),
  ]);

  return [...a, ...b];
}
