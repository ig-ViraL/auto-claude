import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { getCachedInsight, setCachedInsight } from "@/lib/insight-cache";

/**
 * POST /api/insight
 *
 * Streams a 2-3 sentence AI-generated analyst insight for a given stock.
 * Uses Anthropic claude-haiku-4-5 — fastest model, appropriate for short insights.
 *
 * CACHING: In-memory cache with 10-minute TTL per ticker.
 * Cached responses are returned as a plain text response (instant — no delay).
 * Only uncached responses stream token-by-token from the LLM.
 *
 * ERROR ISOLATION: If the AI call fails for any reason, this route returns
 * a 500 with an error body. The client component catches this and shows
 * an error badge WITHOUT affecting the rest of the screener UI.
 */

const insightBodySchema = z.object({
  ticker: z.string().min(1).max(10).toUpperCase(),
  name: z.string().min(1).max(100),
  currentPrice: z.number().positive(),
  percentChange: z.number(),
  peRatio: z.number().nullable(),
  marketCapMillions: z.number().nonnegative(),
  high52Week: z.number().nullable(),
  low52Week: z.number().nullable(),
  priceVs52wHigh: z.number().nullable(),
  industry: z.string(),
});

type InsightBody = z.infer<typeof insightBodySchema>;

function buildPrompt(data: InsightBody): string {
  const mcap =
    data.marketCapMillions >= 1_000_000
      ? `$${(data.marketCapMillions / 1_000_000).toFixed(2)}T`
      : data.marketCapMillions >= 1_000
        ? `$${(data.marketCapMillions / 1_000).toFixed(2)}B`
        : `$${data.marketCapMillions.toFixed(0)}M`;

  const pe = data.peRatio && data.peRatio > 0 ? data.peRatio.toFixed(1) : "N/A";
  const h52 = data.high52Week ? `$${data.high52Week.toFixed(2)}` : "N/A";
  const l52 = data.low52Week ? `$${data.low52Week.toFixed(2)}` : "N/A";
  const vs52h =
    data.priceVs52wHigh !== null
      ? ` (${data.priceVs52wHigh > 0 ? "+" : ""}${data.priceVs52wHigh.toFixed(1)}% vs 52w high)`
      : "";

  return `You are a concise financial analyst. Given the following stock snapshot, write exactly 2-3 sentences of analyst-style commentary. Be direct and factual. No bullet points. No headers. No disclaimers.

Stock: ${data.name} (${data.ticker}) — ${data.industry}
Price: $${data.currentPrice.toFixed(2)}${vs52h}
Today: ${data.percentChange > 0 ? "+" : ""}${data.percentChange.toFixed(2)}%
Market Cap: ${mcap}
P/E Ratio: ${pe}
52-Week Range: ${l52} – ${h52}

Analyst commentary:`;
}

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = insightBodySchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Invalid request body", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const data = parsed.data;

  // Return cached insight immediately (no artificial streaming delay)
  const cached = getCachedInsight(data.ticker);
  if (cached) {
    return new Response(cached, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "X-Insight-Cache": "HIT",
      },
    });
  }

  // Stream from Anthropic
  try {
    const stream = await anthropic.messages.stream({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 200,
      messages: [{ role: "user", content: buildPrompt(data) }],
    });

    // Collect full text while streaming to client
    let fullText = "";

    const readableStream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        try {
          for await (const chunk of stream) {
            if (
              chunk.type === "content_block_delta" &&
              chunk.delta.type === "text_delta"
            ) {
              const text = chunk.delta.text;
              fullText += text;
              controller.enqueue(encoder.encode(text));
            }
          }
          // Cache after successful stream
          if (fullText.trim()) {
            setCachedInsight(data.ticker, fullText);
          }
          controller.close();
        } catch (err) {
          controller.error(err);
        }
      },
    });

    return new Response(readableStream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "X-Insight-Cache": "MISS",
        // Transfer-Encoding: chunked is set automatically by the runtime
      },
    });
  } catch (err) {
    // AI failure must not break the main screener UI.
    // The client catches this 500 and shows an error badge.
    const message = err instanceof Error ? err.message : "AI service error";
    return Response.json(
      { error: "Insight generation failed", details: message },
      { status: 500 }
    );
  }
}
