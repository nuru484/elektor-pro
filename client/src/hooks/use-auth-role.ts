// src/hooks/use-auth-role.ts
"use client";

import { useSelector } from "react-redux";

import type { RootState } from "@/redux/store";
import type { CurrentUser, Role } from "@/types/api";

export interface AuthRole {
  /** True once an auth check (login, refresh, or getMe) has settled. */
  initialized: boolean;
  /** Admin or super-admin (electoral-commission staff). */
  isAdmin: boolean;
  isSuperAdmin: boolean;
  role: null | Role;
  user: CurrentUser | null;
}

/**
 * Current user's role read from the auth store. This mirrors the backend's
 * authorization (which is the real enforcement); the UI uses it only to
 * show/hide actions. Grows a `can(permission)` check when the runtime
 * permission matrix lands (Build 2).
 */
export const useAuthRole = (): AuthRole => {
  const { initialized, user } = useSelector((state: RootState) => state.auth);
  const role = user?.role ?? null;

  const isSuperAdmin = role === "SUPER_ADMIN";
  const isAdmin = isSuperAdmin || role === "ADMIN";

  return { initialized, isAdmin, isSuperAdmin, role, user };
};
