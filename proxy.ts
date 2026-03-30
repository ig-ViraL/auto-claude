import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * proxy.ts — Next.js 16 renamed middleware.ts to proxy.ts.
 * The functionality is identical; the rename better reflects its role
 * as a network-layer proxy that intercepts requests before they reach
 * route handlers.
 *
 * WHY THIS BOUNDARY MATTERS:
 * proxy.ts runs on the Edge runtime — before any route handler executes.
 * This makes it the right place for cross-cutting concerns like rate limiting,
 * auth checks, and header injection. Route handlers run after the proxy has
 * already decided whether to allow the request through.
 *
 * PRODUCTION LIMITATION (noted here proactively):
 * This rate limiter uses an in-memory Map. It does not survive:
 *   - Server restarts
 *   - Horizontal scaling (each instance has its own Map)
 * In production, replace with a distributed store (Redis, Upstash, etc.).
 * See DECISIONS.md for the full trade-off discussion.
 */

// IP → { count, resetAt (ms timestamp) }
const rateLimiter = new Map<string, { count: number; resetAt: number }>();

const RATE_LIMIT = 30; // requests
const WINDOW_MS = 60 * 1000; // per minute

function getRateLimitHeaders(
  remaining: number,
  resetAt: number
): Record<string, string> {
  return {
    "X-RateLimit-Limit": String(RATE_LIMIT),
    "X-RateLimit-Remaining": String(Math.max(0, remaining)),
    "X-RateLimit-Reset": String(Math.ceil(resetAt / 1000)),
  };
}

export function proxy(request: NextRequest) {
  // Only rate-limit API routes
  if (!request.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    request.headers.get("x-real-ip") ??
    "127.0.0.1";

  const now = Date.now();
  const existing = rateLimiter.get(ip);

  if (!existing || now > existing.resetAt) {
    // New window
    const entry = { count: 1, resetAt: now + WINDOW_MS };
    rateLimiter.set(ip, entry);
    const response = NextResponse.next();
    const headers = getRateLimitHeaders(RATE_LIMIT - 1, entry.resetAt);
    Object.entries(headers).forEach(([k, v]) => response.headers.set(k, v));
    return response;
  }

  if (existing.count >= RATE_LIMIT) {
    return new NextResponse(
      JSON.stringify({ error: "Rate limit exceeded. Try again in a minute." }),
      {
        status: 429,
        headers: {
          "Content-Type": "application/json",
          ...getRateLimitHeaders(0, existing.resetAt),
          "Retry-After": String(Math.ceil((existing.resetAt - now) / 1000)),
        },
      }
    );
  }

  existing.count++;
  const response = NextResponse.next();
  const headers = getRateLimitHeaders(
    RATE_LIMIT - existing.count,
    existing.resetAt
  );
  Object.entries(headers).forEach(([k, v]) => response.headers.set(k, v));
  return response;
}

export const config = {
  matcher: "/api/:path*",
};
