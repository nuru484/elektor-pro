// src/utils/date-window.ts
//
// Shared parsing for `?from=YYYY-MM-DD&to=YYYY-MM-DD` list filters: every
// list endpoint filters by date.

/**
 * Parse a `YYYY-MM-DD` query value into a UTC day boundary. `nextDay` shifts
 * to the following midnight so it can serve as an exclusive upper bound that
 * still includes the whole selected day. Invalid input is ignored.
 */
export const dayBoundary = (
  value: unknown,
  nextDay = false,
): Date | undefined => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return undefined;
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return undefined;
  if (nextDay) date.setUTCDate(date.getUTCDate() + 1);
  return date;
};
