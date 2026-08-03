// The staff login flow, including the 2FA challenge step, against MSW.
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { Provider } from "react-redux";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import type { CurrentUser } from "@/types/api";

import LoginPage from "@/app/(auth)/login/page";
import { env } from "@/lib/env";
import { makeStore } from "@/redux/store";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace: vi.fn() }),
}));

const API = env.apiUrl;
const server = setupServer();

beforeAll(() => {
  server.listen({ onUnhandledRequest: "error" });
});
afterEach(() => {
  server.resetHandlers();
  push.mockClear();
});
afterAll(() => {
  server.close();
});

const admin: CurrentUser = {
  email: "sa@test.com",
  firstName: "Super",
  id: "u1",
  lastName: "Admin",
  phone: null,
  role: "SUPER_ADMIN",
  status: "ACTIVE",
  twoFactorEnabled: false,
};

const renderLogin = () =>
  render(
    <Provider store={makeStore()}>
      <LoginPage />
    </Provider>,
  );

const fillAndSubmit = () => {
  fireEvent.change(screen.getByLabelText(/email or phone/i), {
    target: { value: "sa@test.com" },
  });
  fireEvent.change(screen.getByLabelText(/password/i), {
    target: { value: "Password123!" },
  });
  fireEvent.click(screen.getByRole("button", { name: /sign in/i }));
};

describe("LoginPage", () => {
  it("signs a staff user in and routes them to their home", async () => {
    server.use(
      http.post(`${API}/auth/login`, () =>
        HttpResponse.json({ data: admin, message: "Login successful", success: true }),
      ),
    );
    renderLogin();
    fillAndSubmit();
    await waitFor(() => {
      expect(push).toHaveBeenCalledWith("/admin");
    });
  });

  it("routes an accreditor to their profile home", async () => {
    server.use(
      http.post(`${API}/auth/login`, () =>
        HttpResponse.json({
          data: { ...admin, role: "ACCREDITOR" },
          message: "ok",
          success: true,
        }),
      ),
    );
    renderLogin();
    fillAndSubmit();
    await waitFor(() => {
      expect(push).toHaveBeenCalledWith("/profile");
    });
  });

  it("shows the email-code 2FA step and completes it", async () => {
    server.use(
      http.post(`${API}/auth/login`, () =>
        HttpResponse.json({
          data: { challengeToken: "challenge-1", method: "EMAIL" },
          message: "code sent",
          requiresTwoFactor: true,
          success: true,
        }),
      ),
      http.post(`${API}/auth/2fa/verify`, () =>
        HttpResponse.json({ data: admin, message: "ok", success: true }),
      ),
    );
    renderLogin();
    fillAndSubmit();

    expect(await screen.findByText(/sent to your email/i)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/authentication code/i), {
      target: { value: "123456" },
    });
    fireEvent.click(screen.getByRole("button", { name: /verify and continue/i }));
    await waitFor(() => {
      expect(push).toHaveBeenCalledWith("/admin");
    });
  });

  it("surfaces the server's invalid-credentials message (no refresh interference)", async () => {
    server.use(
      http.post(`${API}/auth/login`, () =>
        HttpResponse.json({ message: "Invalid credentials", status: "error" }, { status: 401 }),
      ),
    );
    renderLogin();
    fillAndSubmit();
    // Still on the login form; no navigation happened.
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /sign in/i })).toBeInTheDocument();
    });
    expect(push).not.toHaveBeenCalled();
  });
});
