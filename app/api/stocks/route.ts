import { z } from "zod";
import { fetchAllStocks, fetchStockData } from "@/lib/finnhub";
import { TICKERS } from "@/lib/stocks";

/**
 * GET /api/stocks
 *
 * Returns current data for all tracked stocks (or a subset via ?symbols=).
 * Quotes are always fresh. Profiles and metrics use server-side 'use cache'.
 *
 * Caching: NOT cached at the route level — quotes must be fresh per request.
 * Profile and metric data is cached inside fetchProfile/fetchMetrics helpers.
 */

const querySchema = z.object({
  symbols: z
    .string()
    .optional()
    .transform((v) => (v ? v.split(",").map((s) => s.trim().toUpperCase()) : null)),
});

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const parsed = querySchema.safeParse({
    symbols: searchParams.get("symbols") ?? undefined,
  });

  if (!parsed.success) {
    return Response.json(
      { error: "Invalid query parameters", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const tickers = parsed.data.symbols ?? TICKERS;

  // Validate requested tickers against our known list
  const validTickers = tickers.filter((t) =>
    (TICKERS as readonly string[]).includes(t)
  );

  if (validTickers.length === 0) {
    return Response.json(
      { error: "No valid ticker symbols provided" },
      { status: 400 }
    );
  }

  try {
    const stocks =
      validTickers.length === TICKERS.length
        ? await fetchAllStocks(TICKERS)
        : await Promise.all(validTickers.map(fetchStockData));

    return Response.json({
      stocks,
      fetchedAt: Date.now(),
      count: stocks.length,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return Response.json(
      { error: "Failed to fetch stock data", details: message },
      { status: 502 }
    );
  }
}
