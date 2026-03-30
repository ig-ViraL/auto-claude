"use client";

import { useState, useRef } from "react";
import type { StockData } from "@/lib/types";

type State =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "streaming"; text: string }
  | { status: "done"; text: string }
  | { status: "error"; message: string };

/**
 * AI insight panel for a single stock.
 *
 * Streams token-by-token from /api/insight using ReadableStream.
 * If the response is cached server-side, it arrives instantly as a full
 * plain text response — displayed immediately (no artificial streaming delay).
 * If streaming from the LLM, tokens appear progressively.
 *
 * FAILURE ISOLATION: Errors are contained here. The rest of the screener
 * continues working regardless of this component's state.
 */
export function InsightPanel({ stock }: { stock: StockData }) {
  const [state, setState] = useState<State>({ status: "idle" });
  const abortRef = useRef<AbortController | null>(null);

  async function generate() {
    // Abort any in-flight request
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setState({ status: "loading" });

    try {
      const res = await fetch("/api/insight", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ticker: stock.ticker,
          name: stock.name,
          currentPrice: stock.currentPrice,
          percentChange: stock.percentChange,
          peRatio: stock.peRatio,
          marketCapMillions: stock.marketCapMillions,
          high52Week: stock.high52Week,
          low52Week: stock.low52Week,
          priceVs52wHigh: stock.priceVs52wHigh,
          industry: stock.industry,
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Unknown error" }));
        setState({ status: "error", message: err.error ?? "Insight unavailable" });
        return;
      }

      const cached = res.headers.get("X-Insight-Cache") === "HIT";

      if (cached) {
        // Cached: display immediately
        const text = await res.text();
        setState({ status: "done", text });
        return;
      }

      // Streaming: read token by token
      if (!res.body) {
        setState({ status: "error", message: "No response body" });
        return;
      }

      setState({ status: "streaming", text: "" });
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        accumulated += decoder.decode(value, { stream: true });
        setState({ status: "streaming", text: accumulated });
      }
      setState({ status: "done", text: accumulated });
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      setState({
        status: "error",
        message: err instanceof Error ? err.message : "Insight generation failed",
      });
    }
  }

  if (state.status === "idle") {
    return (
      <button
        onClick={generate}
        className="inline-flex items-center gap-1.5 rounded-lg border border-violet-200 bg-violet-50 px-3 py-1.5 text-xs font-medium text-violet-700 transition hover:bg-violet-100"
      >
        <SparklesIcon />
        AI Insight
      </button>
    );
  }

  if (state.status === "loading") {
    return (
      <div className="flex items-center gap-2 text-xs text-slate-500">
        <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-violet-300 border-t-violet-600" />
        Generating…
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center gap-1 rounded-md bg-red-50 px-2 py-1 text-xs font-medium text-red-600">
          <ErrorIcon />
          {state.message}
        </span>
        <button
          onClick={() => setState({ status: "idle" })}
          className="text-xs text-slate-400 hover:text-slate-600"
        >
          Dismiss
        </button>
      </div>
    );
  }

  // streaming or done
  return (
    <div className="space-y-2">
      <p className="text-sm leading-relaxed text-slate-700">
        {state.text}
        {state.status === "streaming" && (
          <span className="ml-0.5 inline-block h-3.5 w-0.5 animate-pulse bg-violet-500 align-middle" />
        )}
      </p>
      <div className="flex items-center gap-3">
        <span className="text-xs text-slate-400">AI analysis · Claude Haiku</span>
        <button
          onClick={() => setState({ status: "idle" })}
          className="text-xs text-slate-400 hover:text-slate-600"
        >
          Dismiss
        </button>
        {state.status === "done" && (
          <button
            onClick={generate}
            className="text-xs text-violet-500 hover:text-violet-700"
          >
            Regenerate
          </button>
        )}
      </div>
    </div>
  );
}

function SparklesIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 3l1.8 5.4L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.6z" />
      <path d="M5 3l.9 2.7L8.5 7l-2.6.9L5 10.5l-.9-2.6L1.5 7l2.6-.9z" />
      <path d="M19 17l.9 2.7L22.4 21l-2.5.9L19 24.4l-.9-2.5L15.6 21l2.5-.9z" />
    </svg>
  );
}

function ErrorIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  );
}
