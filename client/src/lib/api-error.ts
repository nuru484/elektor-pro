// src/lib/api-error.ts — turn an RTK Query error into a user-facing message.
import type { FetchBaseQueryError } from "@reduxjs/toolkit/query";

export const getApiErrorMessage = (
  error: unknown,
  fallback = "Something went wrong",
): string => {
  if (error && typeof error === "object" && "data" in error) {
    const data = (error as FetchBaseQueryError).data;
    if (data && typeof data === "object" && "message" in data) {
      return String((data as { message: unknown }).message);
    }
  }
  return fallback;
};
