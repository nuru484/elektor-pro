"use client";

// src/hooks/use-debounce.ts (DMS pattern)
import { useEffect, useState } from "react";

/** Returns `value` only after it has been stable for `delay` ms. */
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);
    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}
