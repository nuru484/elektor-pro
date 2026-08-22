// src/redux/auth/auth-slice.ts
//
// The authenticated user and their effective capabilities. Kept OUTSIDE the
// RTK Query cache on purpose: the silent-refresh path must be able to
// update/clear the user without touching query cache lifecycles, and guards
// must read a stable value that survives cache resets.
import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

import type { CurrentUser } from "@/types/api";

export interface AuthState {
  /** True once an auth check (login, refresh, or getMe) has settled. */
  initialized: boolean;
  user: CurrentUser | null;
}

const initialState: AuthState = {
  initialized: false,
  user: null,
};

const authSlice = createSlice({
  initialState,
  name: "auth",
  reducers: {
    userLoggedIn: (state, action: PayloadAction<{ user: CurrentUser }>) => {
      state.initialized = true;
      state.user = action.payload.user;
    },
    userLoggedOut: (state) => {
      state.initialized = true;
      state.user = null;
    },
  },
});

export const { userLoggedIn, userLoggedOut } = authSlice.actions;
export default authSlice.reducer;
