"use client";

import { useEffect, useRef } from "react";
import type { FinnhubWsTrade } from "@/lib/types";

export type PriceUpdate = {
  ticker: string;
  currentPrice: number;
  timestamp: number;
};

type Options = {
  tickers: readonly string[];
  /** Called every ~500ms with accumulated updates since last flush */
  onBatchUpdate: (updates: Map<string, PriceUpdate>) => void;
  onStatusChange?: (status: "connecting" | "connected" | "reconnecting" | "disconnected") => void;
};

/**
 * Manages a single Finnhub WebSocket connection.
 *
 * WHY BATCHED UPDATES (not setState on every message):
 * The Finnhub WS can deliver dozens of trades per second across 20 tickers.
 * Calling setState on every message causes a React re-render on every tick,
 * producing visible jank and dropped frames. Instead, we accumulate updates
 * in a ref (zero re-renders) and flush to state on a 500ms interval —
 * smooth enough for a price feed, cheap enough for the browser.
 *
 * WHY useRef FOR PENDING UPDATES:
 * The WS onmessage handler is a closure over a stable ref. This avoids
 * the stale-closure problem (no deps on state) and doesn't trigger
 * the flush interval's dependency array to change.
 */
export function useStockWebSocket({
  tickers,
  onBatchUpdate,
  onStatusChange,
}: Options) {
  const pendingRef = useRef<Map<string, PriceUpdate>>(new Map());
  // Stable refs so closures inside useEffect never go stale
  const onBatchUpdateRef = useRef(onBatchUpdate);
  const onStatusChangeRef = useRef(onStatusChange);

  useEffect(() => {
    onBatchUpdateRef.current = onBatchUpdate;
  }, [onBatchUpdate]);

  useEffect(() => {
    onStatusChangeRef.current = onStatusChange;
  }, [onStatusChange]);

  useEffect(() => {
    const token = process.env.NEXT_PUBLIC_FINNHUB_API_KEY;
    if (!token) {
      console.error("[WS] NEXT_PUBLIC_FINNHUB_API_KEY is not set");
      return;
    }

    let ws: WebSocket;
    let reconnectTimeout: ReturnType<typeof setTimeout>;
    let reconnectAttempts = 0;
    let isMounted = true;

    function connect() {
      if (!isMounted) return;
      onStatusChangeRef.current?.("connecting");

      ws = new WebSocket(`wss://ws.finnhub.io?token=${token}`);

      ws.onopen = () => {
        if (!isMounted) { ws.close(); return; }
        reconnectAttempts = 0;
        onStatusChangeRef.current?.("connected");
        // Subscribe to all tickers in one burst
        for (const ticker of tickers) {
          ws.send(JSON.stringify({ type: "subscribe", symbol: ticker }));
        }
      };

      ws.onmessage = (event: MessageEvent<string>) => {
        try {
          const msg = JSON.parse(event.data) as FinnhubWsTrade;
          if (msg.type === "trade" && msg.data) {
            for (const trade of msg.data) {
              // Keep only the latest price per ticker in the pending buffer
              pendingRef.current.set(trade.s, {
                ticker: trade.s,
                currentPrice: trade.p,
                timestamp: trade.t,
              });
            }
          }
        } catch {
          // Silently ignore malformed frames
        }
      };

      ws.onclose = () => {
        if (!isMounted) return;
        // Exponential backoff: 1s, 2s, 4s, … capped at 30s
        const delay = Math.min(1000 * 2 ** reconnectAttempts, 30_000);
        reconnectAttempts++;
        onStatusChangeRef.current?.("reconnecting");
        reconnectTimeout = setTimeout(connect, delay);
      };

      ws.onerror = () => {
        // onerror is always followed by onclose; let onclose drive reconnection
        ws.close();
      };
    }

    connect();

    // Flush pending updates to React state every 500ms
    const flushInterval = setInterval(() => {
      if (pendingRef.current.size > 0) {
        const snapshot = new Map(pendingRef.current);
        pendingRef.current.clear();
        onBatchUpdateRef.current(snapshot);
      }
    }, 500);

    return () => {
      isMounted = false;
      clearInterval(flushInterval);
      clearTimeout(reconnectTimeout);
      // Prevent onclose from scheduling a reconnect after unmount
      ws.onclose = null;
      ws.close();
      onStatusChangeRef.current?.("disconnected");
    };
    // tickers is a module-level constant (readonly array), stable across renders
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
