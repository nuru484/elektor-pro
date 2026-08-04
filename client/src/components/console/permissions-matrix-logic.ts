// Pure state helpers for the permissions matrix page (unit-testable without
// rendering). The matrix is Record<role, Capability[]> as the API ships it.
import type { Capability, Role } from "@/types/api";

export type MatrixState = Record<string, Capability[]>;

/** Defensive copy of the API matrix into local editable state. */
export const buildMatrixState = (matrix: Record<string, Capability[]>): MatrixState =>
  Object.fromEntries(Object.entries(matrix).map(([role, caps]) => [role, [...caps]]));

export const hasCapabilityIn = (
  state: MatrixState,
  role: Role,
  capability: Capability,
): boolean => state[role]?.includes(capability) ?? false;

/** Toggle one cell, returning new state (never mutates). */
export const toggleCapability = (
  state: MatrixState,
  role: Role,
  capability: Capability,
): MatrixState => {
  const current = state[role] ?? [];
  const next = current.includes(capability)
    ? current.filter((c) => c !== capability)
    : [...current, capability];
  return { ...state, [role]: next };
};

/** Roles whose grants differ from the saved matrix (order-insensitive). */
export const changedRoles = (
  saved: Record<string, Capability[]>,
  state: MatrixState,
): Role[] =>
  Object.keys(state).filter((role) => {
    const a = new Set(saved[role] ?? []);
    const b = new Set(state[role] ?? []);
    if (a.size !== b.size) return true;
    for (const cap of a) if (!b.has(cap)) return true;
    return false;
  }) as Role[];
