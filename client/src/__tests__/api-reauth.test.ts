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

  /**
   * Regression: the demo sign-in route was missing from the signed-out entry
   * points, so a successful demo login left the sessionDead latch set from
   * whatever killed the previous session. The next 401 then skipped the
   * refresh entirely and signed the visitor straight back out - "log in from
   * the demo page, click one thing, get thrown to /login".
   */
  it("revives the dead-session latch after a demo login", async () => {
    // 1. Kill a session: the protected call 401s and the refresh 401s too.
    server.use(
      http.get(`${API}/protected-thing`, () =>
        HttpResponse.json({ message: "expired" }, { status: 401 }),
      ),
      http.post(`${API}/auth/refresh`, () =>
        HttpResponse.json({ message: "no session" }, { status: 401 }),
      ),
    );
    await makeStore().dispatch(testApi.endpoints.protectedThing.initiate());

    // 2. Sign in again through the demo route.
    server.resetHandlers();
    let refreshCalls = 0;
    let protectedCalls = 0;
    server.use(
      http.post(`${API}/auth/demo-login`, () =>
        HttpResponse.json({
          data: user,
          message: "Signed in as the demo super admin",
          success: true,
        }),
      ),
      http.get(`${API}/protected-thing`, () => {
        protectedCalls += 1;
        // The access token has aged out once, exactly as it would in the app.
        if (protectedCalls === 1) {
          return HttpResponse.json({ message: "expired" }, { status: 401 });
        }
        return HttpResponse.json({ data: "secret" });
      }),
      http.post(`${API}/auth/refresh`, () => {
        refreshCalls += 1;
        return HttpResponse.json({
          data: user,
          message: "refreshed",
          success: true,
        });
      }),
    );

    const store = makeStore();
    await store.dispatch(authApi.endpoints.demoLogin.initiate({ role: "SUPER_ADMIN" }));

    // 3. The next 401 must refresh and retry rather than force a sign-out.
    const result = await store.dispatch(testApi.endpoints.protectedThing.initiate());

    expect(refreshCalls).toBe(1);
    expect(result.data).toEqual({ data: "secret" });
    expect(store.getState().auth.user?.id).toBe("u1");
  });

  /**
   * Regression: getMe treated every failure as "no session", so a refetch
   * that timed out (a cold or briefly unreachable API) cleared the user and
   * the console guard bounced the visitor to /login mid-task. Only an auth
   * failure may end a session.
   */
  it("keeps the session when the check fails for a non-auth reason", async () => {
    server.use(
      http.get(`${API}/auth/me`, () =>
        HttpResponse.json({ data: user, message: "ok", success: true }),
      ),
    );
    const store = makeStore();
    await store.dispatch(authApi.endpoints.getMe.initiate());
    expect(store.getState().auth.user?.id).toBe("u1");

    // The API goes down; the refetch fails with a server error, not a 401.
    server.resetHandlers();
    server.use(
      http.get(`${API}/auth/me`, () =>
        HttpResponse.json({ message: "upstream down" }, { status: 503 }),
      ),
    );
    await store.dispatch(
      authApi.endpoints.getMe.initiate(undefined, { forceRefetch: true }),
    );

    expect(store.getState().auth.user?.id).toBe("u1");
  });

  it("clears the session when the check fails with a 401", async () => {
    server.use(
      http.get(`${API}/auth/me`, () =>
        HttpResponse.json(
          { code: "EXPIRED_TOKEN", message: "Access token expired." },
          { status: 401 },
        ),
      ),
      http.post(`${API}/auth/refresh`, () =>
        HttpResponse.json({ message: "no session" }, { status: 401 }),
      ),
    );

    const store = makeStore();
    await store.dispatch(authApi.endpoints.getMe.initiate());

    expect(store.getState().auth.user).toBeNull();
    expect(store.getState().auth.initialized).toBe(true);
  });

  /**
   * Regression: several requests that 401 in the same tick each passed the
   * "is the mutex free" check before any of them acquired it, so each fired
   * its own refresh. Every refresh rotates the token server-side, so the
   * later ones presented one that had already been retired - which the server
   * reads as token theft and answers by revoking the session.
   */
  it("fires exactly one refresh when several requests 401 together", async () => {
    let refreshCalls = 0;
    const expired = new Set<string>();

    // The latch that a failed refresh sets lives for the lifetime of the
    // module, so start from a signed-in state the way a real session does.
    server.use(
      http.post(`${API}/auth/login`, () =>
        HttpResponse.json({ data: user, message: "ok", success: true }),
      ),
    );
    const store = makeStore();
    await store.dispatch(
      authApi.endpoints.login.initiate({ emailOrPhone: "sa@test.com", password: "pw" }),
    );
    server.resetHandlers();

    server.use(
      http.get(`${API}/protected-thing`, () => {
        // Each of the three endpoints 401s once, then succeeds.
        if (!expired.has("a")) {
          expired.add("a");
          return HttpResponse.json({ message: "expired" }, { status: 401 });
        }
        return HttpResponse.json({ data: "secret" });
      }),
      http.get(`${API}/auth/me`, () => {
        if (!expired.has("b")) {
          expired.add("b");
          return HttpResponse.json({ message: "expired" }, { status: 401 });
        }
        return HttpResponse.json({ data: user, message: "ok", success: true });
      }),
      http.post(`${API}/auth/refresh`, () => {
        refreshCalls += 1;
        return HttpResponse.json({
          data: user,
          message: "refreshed",
          success: true,
        });
      }),
    );

    await Promise.all([
      store.dispatch(testApi.endpoints.protectedThing.initiate()),
      store.dispatch(authApi.endpoints.getMe.initiate()),
    ]);

    expect(refreshCalls).toBe(1);
    expect(store.getState().auth.user?.id).toBe("u1");
  });

  /**
   * Regression: any failed refresh was read as "the session is gone", so a
   * gateway error or a rate limit during the refresh signed the user out.
   * Only a refresh that is itself rejected as unauthenticated may do that.
   */
  it("keeps the session when the refresh fails for a non-auth reason", async () => {
    server.use(
      http.post(`${API}/auth/login`, () =>
        HttpResponse.json({ data: user, message: "ok", success: true }),
      ),
    );
    const store = makeStore();
    await store.dispatch(
      authApi.endpoints.login.initiate({ emailOrPhone: "sa@test.com", password: "pw" }),
    );
    server.resetHandlers();

    server.use(
      http.get(`${API}/protected-thing`, () =>
        HttpResponse.json({ message: "expired" }, { status: 401 }),
      ),
      http.post(`${API}/auth/refresh`, () =>
        HttpResponse.json({ message: "bad gateway" }, { status: 502 }),
      ),
    );

    const result = await store.dispatch(
      testApi.endpoints.protectedThing.initiate(),
    );

    // The caller sees the transport failure, not a 401 it would read as a
    // sign-out, and the user survives.
    expect("error" in result && result.error).toMatchObject({ status: 502 });
    expect(store.getState().auth.user?.id).toBe("u1");
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
