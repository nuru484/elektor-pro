// Integration test for the mutex-guarded silent-refresh path in api-slice.
// MSW intercepts real fetches at the configured base URL, so the whole chain
// (401 → POST /auth/refresh → retry) is exercised, not mocked internals.
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import type { CurrentUser } from "@/types/api";

import { env } from "@/lib/env";
import { apiSlice } from "@/redux/api-slice";
import { authApi } from "@/redux/auth-api";
import { makeStore } from "@/redux/store";

const API = env.apiUrl;

const user: CurrentUser = {
  email: "sa@test.com",
  firstName: "Super",
  id: "u1",
  lastName: "Admin",
  phone: null,
  role: "SUPER_ADMIN",
  status: "ACTIVE",
  twoFactorEnabled: false,
};

/** A protected endpoint injected just for this test. */
const testApi = apiSlice.injectEndpoints({
  endpoints: (build) => ({
    protectedThing: build.query<{ data: string }, void>({
      query: () => "/protected-thing",
    }),
  }),
});

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

describe("silent token refresh", () => {
  it("refreshes on 401 and retries the original request", async () => {
    let protectedCalls = 0;
    let refreshCalls = 0;

    server.use(
      http.get(`${API}/protected-thing`, () => {
        protectedCalls += 1;
        // First call: expired session. After refresh: success.
        if (protectedCalls === 1) {
          return HttpResponse.json({ message: "expired" }, { status: 401 });
        }
        return HttpResponse.json({ data: "secret" });
      }),
      http.post(`${API}/auth/refresh`, () => {
        refreshCalls += 1;
        return HttpResponse.json({ data: user, message: "refreshed", success: true });
      }),
    );

    const store = makeStore();
    const result = await store.dispatch(testApi.endpoints.protectedThing.initiate());

    expect(result.data).toEqual({ data: "secret" });
    expect(refreshCalls).toBe(1);
    expect(protectedCalls).toBe(2);
    // The refreshed user landed in the auth slice.
    expect(store.getState().auth.user?.id).toBe("u1");
  });

  it("logs out and resets the cache when the refresh also fails", async () => {
    server.use(
      http.get(`${API}/protected-thing`, () =>
        HttpResponse.json({ message: "expired" }, { status: 401 }),
      ),
      http.post(`${API}/auth/refresh`, () =>
        HttpResponse.json({ message: "no session" }, { status: 401 }),
      ),
    );

    const store = makeStore();
    const result = await store.dispatch(testApi.endpoints.protectedThing.initiate());

    // resetApiState() aborts the cache entry, so no data ever lands; what
    // matters is that the session is cleared and marked settled.
    expect(result.data).toBeUndefined();
    expect(store.getState().auth.user).toBeNull();
    expect(store.getState().auth.initialized).toBe(true);
  });

  it("does NOT try to refresh on a login 401 (wrong password surfaces as-is)", async () => {
    let refreshCalls = 0;
    server.use(
      http.post(`${API}/auth/login`, () =>
        HttpResponse.json({ message: "Invalid credentials" }, { status: 401 }),
      ),
      http.post(`${API}/auth/refresh`, () => {
        refreshCalls += 1;
        return HttpResponse.json({ message: "no" }, { status: 401 });
      }),
    );

    const store = makeStore();
    const result = await store.dispatch(
      authApi.endpoints.login.initiate({ emailOrPhone: "x@y.com", password: "wrong" }),
    );

    expect(refreshCalls).toBe(0);
    expect("error" in result && result.error).toMatchObject({
      data: { message: "Invalid credentials" },
      status: 401,
    });
  });

  it("stores the user on a successful login", async () => {
    server.use(
      http.post(`${API}/auth/login`, () =>
        HttpResponse.json({ data: user, message: "Login successful", success: true }),
      ),
    );

    const store = makeStore();
    await store.dispatch(
      authApi.endpoints.login.initiate({ emailOrPhone: "sa@test.com", password: "pw" }),
    );

    expect(store.getState().auth.user?.email).toBe("sa@test.com");
  });

  it("does not store a user when login requires 2FA", async () => {
    server.use(
      http.post(`${API}/auth/login`, () =>
        HttpResponse.json({
          data: { challengeToken: "challenge-123" },
          message: "Two-factor authentication required",
          requiresTwoFactor: true,
          success: true,
        }),
      ),
    );

    const store = makeStore();
    await store.dispatch(
      authApi.endpoints.login.initiate({ emailOrPhone: "sa@test.com", password: "pw" }),
    );

    expect(store.getState().auth.user).toBeNull();
  });
});
