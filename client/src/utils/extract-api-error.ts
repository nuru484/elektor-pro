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

/**
 * What a signed-out 401 should say.
 *
 * The API answers an expired or missing access token in its own terms -
 * "Access token expired.", "Access token not found", "Invalid access token.
 * Please login again". Those describe a mechanism the visitor has never heard
 * of, and they land in a toast at exactly the moment the person is being
 * signed out and is least able to interpret them.
 */
const SESSION_EXPIRED_MESSAGE = "Your session has ended. Please sign in again.";

const TOKEN_ERROR_CODES = new Set([
  "EXPIRED_TOKEN",
  "INVALID_TOKEN",
  "MISSING_TOKEN",
]);

const isSessionMessage = (code?: string, message?: string): boolean =>
  TOKEN_ERROR_CODES.has(code ?? "") || /access token/i.test(message ?? "");

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

    if (status === 401 && isSessionMessage(body.code, body.message)) {
      return { fieldErrors, message: SESSION_EXPIRED_MESSAGE, status };
    }
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

/**
 * Whether a failure actually means "this request was not authenticated".
 *
 * The distinction matters wherever a failure is allowed to end a session. A
 * 401 or 403 says the credentials are no longer good; a timeout, a dropped
 * connection or a 5xx says nothing at all about whether the visitor is signed
 * in - and treating those as a signed-out state logs people out every time
 * the API is briefly slow or unreachable.
 *
 * `queryFulfilled` rejects with the error wrapped in `{ error }`, so unwrap
 * that shape before reading the status.
 */
export const isAuthFailure = (error: unknown): boolean => {
  const unwrapped =
    typeof error === "object" &&
    error !== null &&
    "error" in error &&
    !("status" in error)
      ? (error as { error: unknown }).error
      : error;
  const { status } = extractApiError(unwrapped);
  return status === 401 || status === 403;
};
