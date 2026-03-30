# Architecture Decisions

This document records the reasoning behind each significant architectural choice in the stock screener. It is meant to read like a production engineer's notes — not a feature list.

---

## 1. Rendering Strategy

### Main screener page (`/`) — Dynamic, Suspense-streamed

**Decision:** No `'use cache'` on the page or its data-fetching functions. The page is fully dynamic.

**Why:** Stock prices are the core product. A cached price that is even 30 seconds stale is misleading for an analyst who is deciding whether to act. The "data freshness matters" requirement in the brief maps directly to "do not cache quotes."

The page structure is:
- Static shell (header, page title) — prerendered automatically via PPR
- `<Suspense fallback={<SkeletonTable />}>` wrapping `ScreenerContent` — skeleton shows instantly; quote data streams in at request time

**What IS cached:**
- `fetchProfile()` — `'use cache'` + `cacheLife('days')`: company name, logo, industry, exchange do not change intraday
- `fetchMetrics()` — `'use cache'` + `cacheLife('hours')`: P/E ratio and 52-week range update daily, not per second

This split (fresh quotes, cached profiles/metrics) is the right trade-off. On steady-state loads, only 20 Finnhub quote calls are made per request — not 60.

---

### Stock detail page (`/stock/[ticker]`) — Dynamic

**Decision:** Same as the main page. No `'use cache'` on the page itself. Quote is fresh; profile and metrics come from the same server-side caches.

**Why not `generateStaticParams`?** We could pre-render all 20 ticker pages at build time. But a pre-rendered price from build time (potentially hours ago) would be worse than no price at all — it would look authoritative but be wrong. Dynamic is the correct choice.

**Shareable URL:** `/stock/AAPL` is a stable, bookmarkable, shareable URL that always returns fresh data.

---

### API routes — Dynamic by default

Route handlers in Next.js 16 with `cacheComponents: true` run dynamically by default (no implicit caching). This is correct for all our routes:
- `/api/stocks` — always fresh quotes
- `/api/profile/[ticker]` — profile and metrics use `'use cache'` inside helper functions, not at the route level (as required by Next.js 16 — `'use cache'` cannot be used directly in route handler bodies)
- `/api/insight` — streaming response; caching is handled explicitly in `lib/insight-cache.ts`

---

## 2. Next.js 16 Specifics

### Why `cacheComponents: true` in `next.config.ts`

Enabling this flag activates the `'use cache'` directive and Partial Prerendering (PPR). Without it, the `'use cache'` directive has no effect. The flag also changes the default behaviour: all data fetching runs at request time by default, and caching is opt-in. This is the correct model for a real-time data app.

### Why `proxy.ts` instead of `middleware.ts`

In Next.js 16, `middleware.ts` is renamed to `proxy.ts`. The functionality is identical — it runs on the Edge runtime before any route handler. The name change better reflects its role.

**Why this boundary matters:** The proxy runs in a separate, lightweight Edge runtime. It intercepts requests before they reach Node.js route handlers. This is the right place for cross-cutting concerns (rate limiting, auth redirects) because:
1. It's fast — no cold start on each request
2. It's universal — applies to all matched routes regardless of implementation
3. It separates concerns — rate limiting logic doesn't pollute route handler code

### React Compiler

Enabled in `next.config.ts` (`reactCompiler: true`). The compiler handles memoization of components and hooks automatically. No manual `React.memo` or `useMemo` is used in this codebase — the compiler makes them unnecessary in the common case.

The one exception worth noting: `useCallback` is still used in `StockTable.tsx` for `onBatchUpdate`. **Why the compiler is insufficient here:** The compiler can memoize the callback, but the WebSocket hook internally uses a ref to track the latest version of the callback (to avoid stale closures in the WS `onmessage` handler). Making the intent explicit with `useCallback` makes the data flow easier to reason about during code review. This is a readability trade-off, not a performance necessity.

---

## 3. Real-Time State Management

### WebSocket over polling

Polling (e.g., refetching `/api/stocks` every 5 seconds) would work but:
- Creates unnecessary server-to-Finnhub traffic (20 API calls every 5 seconds)
- Is not real-time — there's always a 0–5s lag
- Consumes rate limit budget rapidly

The Finnhub WebSocket (`wss://ws.finnhub.io`) delivers trades as they happen. For a screener where data freshness is the core value prop, WebSocket is the only correct choice.

### Batched DOM updates (why not `setState` on every trade)

Naive implementation: call `setState` on every WebSocket message. Problem: Finnhub delivers multiple trades per second across 20 tickers. At market open, this can be 10–30 messages/second. Each `setState` triggers a React re-render of the entire table — visible jank, dropped frames, degraded UX.

**Solution:** Accumulate trades in a `useRef` (zero re-renders) and flush to state on a 500ms interval. The result:
- Maximum 2 re-renders/second regardless of trade volume
- Each re-render applies all accumulated price changes in one pass
- The UI feels live (prices update visually every 500ms) without frame drops

**Why 500ms?** Financial data UIs conventionally refresh at 250ms–1s intervals. 500ms is smooth enough to feel live while being kind to the browser and any connected monitors.

### Reconnection strategy

The WebSocket hook implements exponential backoff: `min(1000 × 2^attempts, 30000)`. This means:
- First disconnect: retry in 1s
- Second: 2s, then 4s, 8s, 16s, 30s (capped)

This prevents thundering herd if Finnhub has an outage while ensuring reconnection happens quickly on transient drops (common on mobile networks).

---

## 4. Screener Filters

### Why these 3 filters?

**% Change today (min/max):** The most direct daily signal. An analyst screening for momentum buys filters for `minChange > 2`; one looking for oversold conditions filters for `maxChange < -3`. This is the first thing any screener user configures.

**Market cap tier (small/mid/large):** Analysts typically work within a universe. A growth-fund analyst cares about mid/large cap tech. A value investor might focus on small caps. Filtering by cap tier reduces the list to a relevant subset immediately. Thresholds: small < $2B, mid $2B–$10B, large > $10B (standard industry convention).

**Max P/E ratio:** The most common valuation screen. An analyst looking for "cheap" stocks (relative to earnings) sets a P/E ceiling. Filtering for P/E < 20 in this list immediately surfaces JPM, BAC, WMT — the value names. This makes financial sense in a way that "min price" does not.

### Why URL state instead of `useState`

Filters in `useState` are lost on refresh and cannot be shared. A screener is only useful if you can share a filtered view with a colleague. The URL is the right place for filter state — it's durable, shareable, and bookmarkable.

Implementation: `useSearchParams()` for reading, `router.replace()` for writing. Inputs are debounced at 400ms to avoid spamming the router on every keystroke.

---

## 5. AI Insight

### Model choice: Claude Haiku

`claude-haiku-4-5-20251001` — fastest Anthropic model, appropriate for 2-3 sentence outputs. Time-to-first-token is ~200–400ms, which feels responsive for a streaming UI.

### Caching strategy

In-memory Map with a 10-minute TTL per ticker. Rationale:
- Analysts often re-click the same stock (checking the insight again after a price move)
- Re-calling the LLM for the same ticker within 10 minutes adds cost but not value
- 10 minutes is long enough to avoid redundant calls, short enough that re-generation is available if the analyst wants fresh commentary after a significant price move

**Production limitation:** This cache does not survive server restarts or horizontal scaling. In production, replace with Redis/Upstash with the same TTL. The interface (`getCachedInsight`/`setCachedInsight`) is designed for easy swap-out.

### Error isolation

AI failures are caught inside `InsightPanel.tsx` (client component). The component shows an error badge; the parent screener table continues working normally. This is deliberate: an LLM service outage should never make the price feed unusable.

---

## 6. Rate Limiting in `proxy.ts`

### Implementation

In-memory Map: `IP → { count, resetAt }`. Limit: 30 requests/minute per IP. Applied to all `/api/*` routes.

### Production limitations (flagged proactively)

This implementation has two known gaps in production:

1. **Horizontal scaling:** Each server instance has its own in-memory Map. If you run 3 instances, each IP gets 30 req/min per instance = effectively 90 req/min. The fix is a shared store (Redis with `INCR` + `EXPIRE`, or Upstash Rate Limit SDK).

2. **Server restart:** The Map is cleared on restart. An IP that hit the limit can immediately resume after a restart. In practice, this is a minor gap for most use cases.

These limitations are documented here and in comments in `proxy.ts`. They're acceptable for a single-instance deployment; unacceptable for a distributed production system.

---

## 7. What Was Cut (and Why)

**Volume as a filter:** Omitted. Volume data is not reliably available from the Finnhub free-tier quote endpoint (the `v` field is often 0 or absent for non-US exchanges). Showing a filter that silently filters everything out would be worse than not having it. If Finnhub premium data were available, this would be the 4th filter.

**WebSocket proxy server:** The Finnhub WS token is currently `NEXT_PUBLIC_` — visible in the browser. In production, I would proxy the WebSocket through the application server (Next.js custom server or a Node.js proxy) to keep the API key server-side. This was cut because it requires a custom server setup that complicates deployment; the trade-off is documented in `.env.local.example`.

**Sorting:** The table is currently unsorted (it shows stocks in the order fetched). A sortable table (by price, % change, market cap) would be the next most valuable feature. It was deprioritised to focus on the WebSocket + filtering core.

**Real-time P/E updates:** P/E is cached for 4 hours. A more accurate implementation would compute P/E from the live price and trailing EPS — but EPS data requires a separate Finnhub endpoint (`/stock/metric`) and the computation adds complexity for marginal accuracy gain intraday.
