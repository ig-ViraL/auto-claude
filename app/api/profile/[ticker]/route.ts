import { z } from "zod";
import { fetchProfile, fetchMetrics } from "@/lib/finnhub";
import { TICKERS } from "@/lib/stocks";

/**
 * GET /api/profile/[ticker]
 *
 * Returns cached company profile and metrics for a single ticker.
 * Profile data is cached for 1 day; metrics for 4 hours.
 * Both caches live inside fetchProfile/fetchMetrics via 'use cache'.
 *
 * Used by the stock detail page for the expanded view.
 */

const tickerSchema = z.object({
  ticker: z.string().toUpperCase().refine(
    (t) => (TICKERS as readonly string[]).includes(t),
    { message: "Unknown ticker symbol" }
  ),
});

export async function GET(
  _request: Request,
  context: { params: Promise<{ ticker: string }> }
) {
  const { ticker } = await context.params;
  const parsed = tickerSchema.safeParse({ ticker });

  if (!parsed.success) {
    return Response.json(
      { error: "Invalid ticker", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    const [profile, metrics] = await Promise.all([
      fetchProfile(parsed.data.ticker),
      fetchMetrics(parsed.data.ticker),
    ]);

    return Response.json({ profile, metrics });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return Response.json(
      { error: "Failed to fetch profile", details: message },
      { status: 502 }
    );
  }
}
