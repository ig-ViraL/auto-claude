# API Reference

All routes live under `/api/`. Rate limiting is applied by `proxy.ts`: **30 requests/minute per IP**.

---

## `GET /api/stocks`

Returns current stock data for all tracked tickers (or a subset).

### Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `symbols` | `string` | No | Comma-separated ticker symbols (e.g. `AAPL,MSFT`). Defaults to all 20 tracked tickers. |

### Response

```json
{
  "stocks": [
    {
      "ticker": "AAPL",
      "currentPrice": 182.50,
      "previousClose": 180.20,
      "percentChange": 1.28,
      "dayHigh": 183.10,
      "dayLow": 180.50,
      "openPrice": 181.00,
      "timestamp": 1711900800,
      "name": "Apple Inc",
      "industry": "Technology",
      "logo": "https://static2.finnhub.io/file/publicDomain/apple.png",
      "marketCapMillions": 2850000,
      "country": "US",
      "currency": "USD",
      "exchange": "NASDAQ",
      "ipo": "1980-12-12",
      "webUrl": "https://www.apple.com/",
      "peRatio": 28.4,
      "high52Week": 199.62,
      "low52Week": 164.08,
      "priceVs52wHigh": -8.6,
      "beta": 1.2,
      "dividendYieldAnnual": 0.005,
      "revenueGrowthTTMYoy": 0.12
    }
  ],
  "fetchedAt": 1711900800000,
  "count": 20
}
```

### Caching

- **Quotes** (`currentPrice`, `percentChange`, etc.): **Not cached** — fresh per request.
- **Profiles** (`name`, `industry`, `logo`, `marketCapMillions`): Cached **1 day** via `'use cache'` in `fetchProfile()`.
- **Metrics** (`peRatio`, `high52Week`, `low52Week`, `beta`): Cached **4 hours** via `'use cache'` in `fetchMetrics()`.

### Errors

| Status | Body | When |
|--------|------|------|
| `400` | `{ "error": "Invalid query parameters" }` | Invalid `symbols` format |
| `400` | `{ "error": "No valid ticker symbols provided" }` | All symbols unknown |
| `429` | `{ "error": "Rate limit exceeded..." }` | >30 req/min from IP |
| `502` | `{ "error": "Failed to fetch stock data" }` | Finnhub API error |

---

## `GET /api/profile/[ticker]`

Returns cached company profile and fundamental metrics for a single ticker.

### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `ticker` | `string` | Ticker symbol (e.g. `AAPL`). Case-insensitive. |

### Response

```json
{
  "profile": {
    "ticker": "AAPL",
    "name": "Apple Inc",
    "industry": "Technology",
    "logo": "https://static2.finnhub.io/file/publicDomain/apple.png",
    "marketCapMillions": 2850000,
    "country": "US",
    "currency": "USD",
    "exchange": "NASDAQ",
    "ipo": "1980-12-12",
    "webUrl": "https://www.apple.com/"
  },
  "metrics": {
    "ticker": "AAPL",
    "peRatio": 28.4,
    "high52Week": 199.62,
    "low52Week": 164.08,
    "priceVs52wHigh": null,
    "beta": 1.2,
    "dividendYieldAnnual": 0.005,
    "revenueGrowthTTMYoy": 0.12
  }
}
```

### Caching

- **Profile**: Cached **1 day** via `'use cache'` + `cacheTag('profile-{ticker}')`.
- **Metrics**: Cached **4 hours** via `'use cache'` + `cacheTag('metrics-{ticker}')`.

Note: `priceVs52wHigh` is `null` here because this endpoint has no access to the current price. It is computed in `fetchStockData()` when both quote and metrics are available together.

### Errors

| Status | Body | When |
|--------|------|------|
| `400` | `{ "error": "Invalid ticker" }` | Unknown ticker symbol |
| `429` | `{ "error": "Rate limit exceeded..." }` | >30 req/min from IP |
| `502` | `{ "error": "Failed to fetch profile" }` | Finnhub API error |

---

## `POST /api/insight`

Generates a 2–3 sentence AI analyst commentary for a stock. Streams token-by-token when uncached; returns instantly when cached.

### Request Body

```json
{
  "ticker": "AAPL",
  "name": "Apple Inc",
  "currentPrice": 182.50,
  "percentChange": 1.28,
  "peRatio": 28.4,
  "marketCapMillions": 2850000,
  "high52Week": 199.62,
  "low52Week": 164.08,
  "priceVs52wHigh": -8.6,
  "industry": "Technology"
}
```

All fields are validated with Zod before the LLM call is attempted.

### Response

- **Content-Type:** `text/plain; charset=utf-8`
- **Transfer-Encoding:** `chunked` (when streaming)
- **X-Insight-Cache:** `HIT` | `MISS`

The response body is plain text — the AI commentary. Stream it with a `ReadableStream` reader in the client.

**Cache HIT:** Returns a single plain text response body (instant, no delay).
**Cache MISS:** Streams tokens from `claude-haiku-4-5-20251001` as they are generated.

### Caching

In-memory per-ticker cache with a **10-minute TTL**. See `lib/insight-cache.ts`. Not shared across server instances or restarts.

### Errors

| Status | Body | When |
|--------|------|------|
| `400` | `{ "error": "Invalid JSON body" }` | Non-JSON request |
| `400` | `{ "error": "Invalid request body" }` | Zod validation failure |
| `429` | `{ "error": "Rate limit exceeded..." }` | >30 req/min from IP |
| `500` | `{ "error": "Insight generation failed" }` | Anthropic API error |

Note: A `500` from this endpoint must **not** break the screener UI. The `InsightPanel` client component handles errors gracefully and shows an error badge.

---

## WebSocket (Client → Finnhub directly)

The screener connects directly to `wss://ws.finnhub.io?token={NEXT_PUBLIC_FINNHUB_API_KEY}` from the browser.

This is **not** proxied through the Next.js application. Trade-off: the API key is client-visible. Acceptable for the Finnhub free tier; in production, proxy the WebSocket through a Node.js server to keep the key server-side.

### Subscribe message

```json
{ "type": "subscribe", "symbol": "AAPL" }
```

### Incoming trade message

```json
{
  "type": "trade",
  "data": [
    { "s": "AAPL", "p": 182.50, "t": 1711900800000, "v": 100, "c": null }
  ]
}
```

Trade messages are batched client-side and flushed to React state every **500ms** to prevent render jank.
