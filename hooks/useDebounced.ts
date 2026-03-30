"use client";

import { useRef, useCallback, useEffect } from "react";

/**
 * Returns a debounced version of `fn` that delays invocation until
 * `delay` ms have elapsed since the last call.
 *
 * Uses a ref to track the latest `fn` (synced in useEffect after each render)
 * so the callback is always stable — it doesn't recreate the debounce timer
 * when the parent's callback identity changes between renders.
 */
export function useDebounced<T extends unknown[]>(
  fn: (...args: T) => void,
  delay: number
): (...args: T) => void {
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const fnRef = useRef(fn);

  // Sync ref after render — avoids the "update ref during render" lint error
  // while still ensuring we always call the latest version of fn.
  useEffect(() => {
    fnRef.current = fn;
  }, [fn]);

  return useCallback(
    (...args: T) => {
      clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => fnRef.current(...args), delay);
    },
    [delay] // stable: delay is a constant at each call site
  );
}
