import { describe, expect, it } from "vitest";

import { extractApiError, getApiErrorMessage } from "@/utils/extract-api-error";

describe("extractApiError", () => {
  it("returns the backend message with the HTTP status", () => {
    const result = extractApiError({ data: { message: "Invalid credentials" }, status: 401 });
    expect(result.message).toBe("Invalid credentials");
    expect(result.status).toBe(401);
    expect(result.fieldErrors).toEqual([]);
  });

  it("extracts field-level validation errors", () => {
    const result = extractApiError({
      data: {
        code: "VALIDATION_ERROR",
        details: { errors: [{ field: "email", message: "Invalid email" }] },
        message: "Validation Error",
      },
      status: 400,
    });
    expect(result.fieldErrors).toEqual([{ field: "email", message: "Invalid email" }]);
    expect(result.message).toBe("Validation Error");
  });

  it("ignores malformed details.errors payloads", () => {
    const result = extractApiError({
      data: { details: { errors: ["not-a-field-error"] }, message: "Bad" },
      status: 400,
    });
    expect(result.fieldErrors).toEqual([]);
  });

  it("maps network failures to a connectivity message", () => {
    const result = extractApiError({ error: "TypeError: fetch failed", status: "FETCH_ERROR" });
    expect(result.message).toMatch(/could not reach the server/i);
    expect(result.status).toBeUndefined();
  });

  it("maps timeouts to a retry message", () => {
    expect(extractApiError({ error: "timeout", status: "TIMEOUT_ERROR" }).message).toMatch(/timed out/i);
  });

  it("uses the fallback for parsing errors, keeping the original status", () => {
    const result = extractApiError(
      { data: "<html>", error: "parse", originalStatus: 502, status: "PARSING_ERROR" },
      "Custom fallback",
    );
    expect(result.message).toBe("Custom fallback");
    expect(result.status).toBe(502);
  });

  it("reads SerializedError messages", () => {
    expect(extractApiError({ message: "serialized boom" }).message).toBe("serialized boom");
  });

  it("falls back for unknown shapes", () => {
    expect(extractApiError(null).message).toMatch(/something went wrong/i);
    expect(extractApiError(undefined, "fb").message).toBe("fb");
    expect(extractApiError("weird").message).toMatch(/something went wrong/i);
  });
});

describe("getApiErrorMessage", () => {
  it("returns only the headline", () => {
    expect(getApiErrorMessage({ data: { message: "Nope" }, status: 403 })).toBe("Nope");
  });
});
