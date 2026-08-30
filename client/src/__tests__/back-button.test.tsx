// The heading back arrow: history when there is any, the href on a deep link.
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { BackButton } from "@/components/ui/back-button";

const back = vi.fn();
const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ back, push }),
}));

function setHistoryLength(length: number) {
  Object.defineProperty(window.history, "length", { configurable: true, value: length });
}

afterEach(() => {
  back.mockClear();
  push.mockClear();
});

describe("BackButton", () => {
  it("names the destination for screen readers", () => {
    setHistoryLength(1);
    render(<BackButton href="/admin/elections" label="Back to elections" />);
    expect(screen.getByRole("button", { name: "Back to elections" })).toBeInTheDocument();
  });

  it("returns to the previous page when there is history behind it", () => {
    setHistoryLength(2);
    render(<BackButton href="/admin/elections" label="Back to elections" />);
    fireEvent.click(screen.getByRole("button", { name: "Back to elections" }));
    expect(back).toHaveBeenCalledTimes(1);
    expect(push).not.toHaveBeenCalled();
  });

  it("navigates to the href when the page was opened directly", () => {
    setHistoryLength(1);
    render(<BackButton href="/admin/elections" label="Back to elections" />);
    fireEvent.click(screen.getByRole("button", { name: "Back to elections" }));
    expect(push).toHaveBeenCalledWith("/admin/elections");
    expect(back).not.toHaveBeenCalled();
  });
});
