// src/utils/extract-api-error.ts
//
// Turn any RTK Query error into something the UI can show: a headline message
// plus optional per-field validation details (the backend's VALIDATION_ERROR
// context). Every mutation/query consumer routes errors through here so
// failure UX stays consistent.
import type { FetchBaseQueryError } from "@reduxjs/toolkit/query";
import type { SerializedError } from "@reduxjs/toolkit";

export interface ApiFieldError {
  field: string;
  message: string;
}

export interface ExtractedApiError {
  /** Per-field validation errors, when the backend sent them. */
  fieldErrors: ApiFieldError[];
  /** Headline message safe to show the user. */
  message: string;
  /** HTTP status when known (e.g. branch on 401/403/404). */
  status?: number;
}

interface BackendErrorBody {
  code?: string;
  details?: { errors?: ApiFieldError[] } & Record<string, unknown>;
  message?: string;
}

const isFetchBaseQueryError = (error: unknown): error is FetchBaseQueryError =>
  typeof error === "object" && error !== null && "status" in error;

const isSerializedError = (error: unknown): error is SerializedError =>
  typeof error === "object" && error !== null && "message" in error && !("status" in error);

const isFieldErrorArray = (value: unknown): value is ApiFieldError[] =>
  Array.isArray(value) &&
  value.every(
    (item) =>
      typeof item === "object" &&
      item !== null &&
      typeof (item as ApiFieldError).field === "string" &&
      typeof (item as ApiFieldError).message === "string",
  );

export const extractApiError = (
  error: unknown,
  fallback = "Something went wrong. Please try again.",
): ExtractedApiError => {
  if (isFetchBaseQueryError(error)) {
    // Network-level failures have string statuses, not HTTP codes.
    if (error.status === "FETCH_ERROR") {
      return {
        fieldErrors: [],
        message: "Could not reach the server. Check your connection and try again.",
      };
    }
    if (error.status === "TIMEOUT_ERROR") {
      return { fieldErrors: [], message: "The request timed out. Please try again." };
    }
    if (error.status === "PARSING_ERROR") {
      return { fieldErrors: [], message: fallback, status: error.originalStatus };
    }

    const body = (typeof error.data === "object" && error.data !== null ? error.data : {}) as BackendErrorBody;
    const fieldErrors = isFieldErrorArray(body.details?.errors) ? body.details.errors : [];
    const status = typeof error.status === "number" ? error.status : undefined;

    if (body.message) {
      return { fieldErrors, message: body.message, status };
    }
    return { fieldErrors, message: fallback, status };
  }

  if (isSerializedError(error) && error.message) {
    return { fieldErrors: [], message: error.message };
  }

  return { fieldErrors: [], message: fallback };
};

/** Convenience for call sites that only need the headline string. */
export const getApiErrorMessage = (error: unknown, fallback?: string): string =>
  extractApiError(error, fallback).message;
