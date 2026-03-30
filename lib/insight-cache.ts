/**
 * In-memory insight cache.
 *
 * STRATEGY: Cache AI-generated insights for 10 minutes per ticker.
 * After 10 minutes the insight expires and the next request regenerates it.
 * This balances freshness (stock data changes) against API cost (LLM calls
 * are expensive and slow). A ticker clicked repeatedly in the same session
 * gets instant cached responses after the first generation.
 *
 * PRODUCTION LIMITATION: This is a module-level singleton — it does not
 * persist across server restarts or survive horizontal scaling. In production,
 * replace with Redis (or similar) with the same TTL semantics. See DECISIONS.md.
 */

type CacheEntry = {
  text: string;
  createdAt: number;
};

const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

const cache = new Map<string, CacheEntry>();

export function getCachedInsight(ticker: string): string | null {
  const entry = cache.get(ticker);
  if (!entry) return null;
  if (Date.now() - entry.createdAt > CACHE_TTL_MS) {
    cache.delete(ticker);
    return null;
  }
  return entry.text;
}

export function setCachedInsight(ticker: string, text: string): void {
  cache.set(ticker, { text, createdAt: Date.now() });
}
