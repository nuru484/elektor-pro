// src/hooks/use-auth-role.ts
"use client";

import { useSelector } from "react-redux";

import type { RootState } from "@/redux/store";
import type { Capability, CurrentUser, Role } from "@/types/api";

export interface AuthRole {
  /** True when the user holds the capability (runtime matrix + grants). */
  can: (capability: Capability) => boolean;
  /** True once an auth check (login, refresh, or getMe) has settled. */
  initialized: boolean;
  /** Admin or super-admin (electoral-commission staff). */
  isAdmin: boolean;
  isSuperAdmin: boolean;
  role: null | Role;
  user: CurrentUser | null;
}

/**
 * Current user's role and effective capabilities read from the auth store.
 * This mirrors the backend's authorization (which is the real enforcement);
 * the UI uses it only to show/hide actions.
 */
export const useAuthRole = (): AuthRole => {
  const { initialized, user } = useSelector((state: RootState) => state.auth);
  const role = user?.role ?? null;

  const isSuperAdmin = role === "SUPER_ADMIN";
  const isAdmin = isSuperAdmin || role === "ADMIN";

  const can = (capability: Capability): boolean =>
    isSuperAdmin || (user?.capabilities?.includes(capability) ?? false);

  return { can, initialized, isAdmin, isSuperAdmin, role, user };
};
