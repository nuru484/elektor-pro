import { describe, expect, it } from "vitest";

import type { CurrentUser } from "@/types/api";

import authReducer, { userLoggedIn, userLoggedOut } from "@/redux/auth/auth-slice";

const user: CurrentUser = {
  email: "a@b.com",
  firstName: "Ada",
  id: "u1",
  lastName: "Mensah",
  phone: null,
  role: "ADMIN",
  status: "ACTIVE",
  twoFactorEnabled: true,
};

describe("auth slice", () => {
  it("starts uninitialized with no user", () => {
    const state = authReducer(undefined, { type: "@@INIT" });
    expect(state).toEqual({ initialized: false, user: null });
  });

  it("stores the user and marks initialized on login", () => {
    const state = authReducer(undefined, userLoggedIn({ user }));
    expect(state.user).toEqual(user);
    expect(state.initialized).toBe(true);
  });

  it("clears the user but stays initialized on logout", () => {
    const loggedIn = authReducer(undefined, userLoggedIn({ user }));
    const state = authReducer(loggedIn, userLoggedOut());
    expect(state.user).toBeNull();
    expect(state.initialized).toBe(true);
  });
});
