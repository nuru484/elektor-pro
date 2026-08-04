// Component test: the signed-in devices list against an MSW-mocked API.
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { Provider } from "react-redux";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import type { SessionView } from "@/types/api";

import { SessionsSection } from "@/components/profile/sessions-section";
import { env } from "@/lib/env";
import { makeStore } from "@/redux/store";

const API = env.apiUrl;
const server = setupServer();

beforeAll(() => {
  server.listen({ onUnhandledRequest: "error" });
});
afterEach(() => {
  server.resetHandlers();
});
afterAll(() => {
  server.close();
});

const sessions: SessionView[] = [
  {
    createdAt: "2026-08-01T10:00:00.000Z",
    current: true,
    id: "s-current",
    ipAddress: "10.0.0.1",
    lastUsedAt: "2026-08-03T10:00:00.000Z",
    userAgent: "Mozilla/5.0 (Windows NT 10.0) Chrome/126.0",
  },
  {
    createdAt: "2026-08-02T10:00:00.000Z",
    current: false,
    id: "s-phone",
    ipAddress: "10.0.0.2",
    lastUsedAt: "2026-08-02T12:00:00.000Z",
    userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0) Safari/604.1",
  },
];

const renderSection = () =>
  render(
    <Provider store={makeStore()}>
      <SessionsSection />
    </Provider>,
  );

describe("SessionsSection", () => {
  it("lists devices, flags the current one, and describes user agents", async () => {
    server.use(
      http.get(`${API}/auth/sessions`, () =>
        HttpResponse.json({ data: sessions, message: "ok", success: true }),
      ),
    );
    renderSection();

    expect(await screen.findByText("Chrome on Windows")).toBeInTheDocument();
    expect(screen.getByText("Safari on iOS")).toBeInTheDocument();
    expect(screen.getByText("This device")).toBeInTheDocument();
    // Only the non-current device gets a per-row sign out button.
    expect(screen.getAllByRole("button", { name: /sign this device out/i })).toHaveLength(1);
    expect(
      screen.getByRole("button", { name: /sign out everywhere else/i }),
    ).toBeInTheDocument();
  });

  it("revokes a device and refetches the list", async () => {
    let revoked = false;
    server.use(
      http.get(`${API}/auth/sessions`, () =>
        HttpResponse.json({
          data: revoked ? [sessions[0]] : sessions,
          message: "ok",
          success: true,
        }),
      ),
      http.delete(`${API}/auth/sessions/s-phone`, () => {
        revoked = true;
        return HttpResponse.json({ data: { id: "s-phone" }, message: "ok", success: true });
      }),
    );
    renderSection();

    // Revoking asks for confirmation first (shared ConfirmationDialog).
    fireEvent.click(await screen.findByRole("button", { name: /sign this device out/i }));
    expect(await screen.findByText(/sign this device out\?/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /^sign device out$/i }));

    await waitFor(() => {
      expect(screen.queryByText("Safari on iOS")).not.toBeInTheDocument();
    });
    expect(revoked).toBe(true);
  });

  it("shows an error state when the list fails", async () => {
    server.use(
      http.get(`${API}/auth/sessions`, () =>
        HttpResponse.json({ message: "boom" }, { status: 500 }),
      ),
    );
    renderSection();
    expect(await screen.findByText(/could not load your sessions/i)).toBeInTheDocument();
  });
});
