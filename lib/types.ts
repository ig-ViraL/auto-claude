/**
 * Shared TypeScript types for the stock screener.
 * All types are derived from the Finnhub API response shapes,
 * normalised and enriched with computed fields.
 */

/** Raw normalised quote from Finnhub /quote endpoint */
export type StockQuote = {
  ticker: string;
  currentPrice: number;
  previousClose: number;
  /** Computed: ((currentPrice - previousClose) / previousClose) * 100 */
  percentChange: number;
  dayHigh: number;
  dayLow: number;
  openPrice: number;
  /** Unix timestamp of last trade (seconds) */
  timestamp: number;
};

/** Company metadata from Finnhub /stock/profile2 endpoint */
export type StockProfile = {
  ticker: string;
  name: string;
  industry: string;
  logo: string;
  /** In millions USD — matches Finnhub's marketCapitalization field */
  marketCapMillions: number;
  country: string;
  currency: string;
  exchange: string;
  ipo: string;
  webUrl: string;
};

/** Valuation metrics from Finnhub /stock/metric endpoint */
export type StockMetrics = {
  ticker: string;
  peRatio: number | null;
  high52Week: number | null;
  low52Week: number | null;
  /** Computed: ((currentPrice - high52Week) / high52Week) * 100 — negative means below 52w high */
  priceVs52wHigh: number | null;
  beta: number | null;
  dividendYieldAnnual: number | null;
  revenueGrowthTTMYoy: number | null;
};

/** Combined stock data used in the screener table */
export type StockData = StockQuote & StockProfile & StockMetrics;

/** Filter state — all values are optional; absent = no filter applied */
export type FilterState = {
  search: string;
  minChange: string;
  maxChange: string;
  marketCap: "all" | "small" | "mid" | "large";
  maxPE: string;
  minVolume: string;
};

/** Market cap tier thresholds (in millions USD, matching Finnhub's unit) */
export const MARKET_CAP_TIERS = {
  small: { max: 2_000 }, // < $2B
  mid: { min: 2_000, max: 10_000 }, // $2B – $10B
  large: { min: 10_000 }, // > $10B
} as const;

/** Finnhub raw quote response shape (before normalisation) */
export type FinnhubQuoteRaw = {
  c: number; // current price
  d: number; // change
  dp: number; // percent change
  h: number; // day high
  l: number; // day low
  o: number; // open
  pc: number; // previous close
  t: number; // timestamp
};

/** Finnhub WebSocket trade message */
export type FinnhubWsTrade = {
  type: "trade" | "ping";
  data?: Array<{
    s: string; // symbol
    p: number; // price
    t: number; // timestamp (ms)
    v: number; // volume
    c: string[] | null; // conditions
  }>;
};
