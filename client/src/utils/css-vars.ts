import type { CSSProperties } from "react";

/**
 * Style object carrying CSS custom properties.
 *
 * React's CSSProperties has no index signature, so a literal like
 * `{ "--i": 2 }` fails to type-check even though React sets it correctly at
 * runtime. This narrows the cast to one place instead of scattering
 * `as CSSProperties` across every call site.
 */
export const cssVars = (
  vars: Record<`--${string}`, number | string>,
): CSSProperties => vars as CSSProperties;
