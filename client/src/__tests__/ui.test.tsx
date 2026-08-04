import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { Pagination } from "@/components/ui/pagination";
import { StatusBadge } from "@/components/ui/status-badge";
import { getApiErrorMessage } from "@/utils/extract-api-error";
import { cn } from "@/lib/utils";

describe("cn", () => {
  it("merges and dedupes tailwind classes", () => {
    expect(cn("p-2", "p-4")).toBe("p-4");
    expect(cn("text-sm", false, "font-bold")).toBe("text-sm font-bold");
  });
});

describe("getApiErrorMessage", () => {
  it("extracts the backend message", () => {
    expect(getApiErrorMessage({ data: { message: "Nope" }, status: 400 })).toBe("Nope");
  });
  it("falls back when no message", () => {
    expect(getApiErrorMessage(undefined, "fallback")).toBe("fallback");
  });
});

describe("StatusBadge", () => {
  it("renders a humanized label", () => {
    render(<StatusBadge status="IN_PROGRESS" />);
    expect(screen.getByText("in progress")).toBeInTheDocument();
  });
});

describe("Pagination", () => {
  const meta = { limit: 10, page: 1, total: 25, totalPages: 3 };

  it("shows the current range and disables Prev on page 1", () => {
    render(<Pagination meta={meta} onPageChange={() => {}} />);
    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /prev/i })).toBeDisabled();
  });

  it("advances the page on Next", () => {
    const onPageChange = vi.fn();
    render(<Pagination meta={meta} onPageChange={onPageChange} />);
    fireEvent.click(screen.getByRole("button", { name: /next/i }));
    expect(onPageChange).toHaveBeenCalledWith(2);
  });

  it("renders nothing when there are no rows", () => {
    const { container } = render(
      <Pagination meta={{ limit: 10, page: 1, total: 0, totalPages: 1 }} onPageChange={() => {}} />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
