# Stock Screener

A real-time stock screener built with Next.js 16, TypeScript, and the Finnhub API. Features live WebSocket price updates, URL-driven filters, and AI-powered analyst insights via Claude.

## Features

- **20 stocks** — diversified across tech, finance, consumer, and healthcare
- **Live prices** — Finnhub WebSocket feed, updates every ~500ms without page reload
- **URL-driven filters** — % change, market cap tier, P/E ratio; shareable and refresh-safe
- **Stock detail view** — full metrics including 52-week range, beta, revenue growth
- **AI insights** — streaming analyst commentary via Claude Haiku, cached for 10 minutes
- **Next.js 16** — `cacheComponents`, `'use cache'` directive, `proxy.ts` rate limiter, React Compiler

## Prerequisites

- Node.js 20+
- A [Finnhub](https://finnhub.io) free-tier API key
- An [Anthropic](https://console.anthropic.com) API key

## Setup

```bash
# 1. Clone and install
git clone <repo-url>
cd auto-claude
npm install

# 2. Configure environment variables
cp .env.local.example .env.local
# Edit .env.local with your API keys

# 3. Start the development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `FINNHUB_API_KEY` | Yes | Server-side Finnhub key (for REST API calls) |
| `NEXT_PUBLIC_FINNHUB_API_KEY` | Yes | Client-side Finnhub key (for WebSocket in browser) |
| `ANTHROPIC_API_KEY` | Yes | Anthropic key for AI insights |

Both Finnhub variables can use the same key value from your Finnhub dashboard.

## Architecture Overview

```
app/
  page.tsx                  — Main screener (dynamic, Suspense-streamed)
  loading.tsx               — Route-level skeleton
  stock/[ticker]/
    page.tsx                — Detail view (dynamic, shareable URL)
    loading.tsx             — Detail skeleton

app/api/
  stocks/route.ts           — Bulk quote endpoint (Zod-validated)
  profile/[ticker]/route.ts — Cached profile + metrics
  insight/route.ts          — Streaming AI insight

components/
  StockTable.tsx            — Client component: WebSocket + filter + table
  StockRow.tsx              — Individual stock row with price flash
  FilterPanel.tsx           — URL-driven filter bar (debounced inputs)
  InsightPanel.tsx          — Streaming AI insight with error isolation
  ConnectionStatus.tsx      — WebSocket status indicator
  SkeletonTable.tsx         — Loading skeletons

hooks/
  useStockWebSocket.ts      — WS connection, reconnection, batched updates
  useDebounced.ts           — Debounce hook for filter inputs

lib/
  types.ts                  — Shared TypeScript types
  stocks.ts                 — Canonical ticker list (20 stocks)
  finnhub.ts                — Finnhub API helpers (with 'use cache')
  insight-cache.ts          — In-memory insight cache (10-min TTL)
  format.ts                 — Financial data formatting utilities

proxy.ts                    — Rate limiter (30 req/min/IP) — Next.js 16 proxy
```

## Running the Bundle Analyser

```bash
ANALYZE=true npm run build
```

The analyser output will open automatically in your browser.

## Known Issues and Limitations

1. **WebSocket API key is client-visible** — `NEXT_PUBLIC_FINNHUB_API_KEY` is exposed in the browser. For production, proxy the WebSocket through your server. See DECISIONS.md.

2. **Rate limiter is in-memory** — `proxy.ts` uses an in-memory Map. It does not survive restarts or work correctly across multiple instances. Replace with Redis for production scale. See DECISIONS.md.

3. **Volume filter not included** — The Finnhub free-tier quote endpoint does not reliably return volume data. See DECISIONS.md.

4. **Insight cache is ephemeral** — The 10-minute in-memory insight cache resets on server restart. Replace with Redis for production persistence.

5. **Market hours** — Outside US market hours (9:30 AM – 4:00 PM ET), the Finnhub WebSocket sends no trade messages. Prices shown are from the last trading session. The connection status indicator will show "Live" (connected to WS) but prices won't update until the market reopens.

## Documentation

- [`DECISIONS.md`](./DECISIONS.md) — Architecture decisions and trade-offs
- [`API.md`](./API.md) — API route documentation

## Tech Stack

- **Next.js 16** (App Router, `cacheComponents`, React Compiler, `proxy.ts`)
- **TypeScript** (strict mode, no unexplained `any`)
- **Tailwind CSS v4** (no component libraries)
- **Zod** (request validation)
- **Anthropic SDK** (AI insights)
- **Finnhub API + WebSocket** (real-time market data)
