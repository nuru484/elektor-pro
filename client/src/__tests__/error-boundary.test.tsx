// The route-segment error boundary reports the failed render to Sentry.
import { render, screen } from "@testing-library/react";
import * as Sentry from "@sentry/nextjs";
import { describe, expect, it, vi } from "vitest";

import ErrorBoundary from "@/app/error";

vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));

describe("ErrorBoundary", () => {
  it("captures the error on mount and still renders the retry UI", () => {
    const error = Object.assign(new Error("boom"), { digest: "abc123" });
    render(<ErrorBoundary error={error} reset={vi.fn()} />);

    expect(Sentry.captureException).toHaveBeenCalledTimes(1);
    expect(Sentry.captureException).toHaveBeenCalledWith(error);
    expect(
      screen.getByRole("button", { name: "Try again" }),
    ).toBeInTheDocument();
  });
});
