// src/utils/dashboard-window.ts
// Pure helpers for dashboard aggregates: trend deltas between two windows
// and zero-filled daily series (a day with no ballots must still appear,
// otherwise the chart silently skips it and the x-axis lies).

export interface TrendData {
  direction: 'downward' | 'neutral' | 'upward';
  percentage: number;
}

/** Percent change of `current` over `previous`, with a safe zero baseline. */
export const calculateTrend = (
  current: number,
  previous: number,
): TrendData => {
  if (previous === 0) {
    return {
      direction: current > 0 ? 'upward' : 'neutral',
      percentage: current > 0 ? 100 : 0,
    };
  }
  const pct = ((current - previous) / previous) * 100;
  return {
    direction: pct > 0 ? 'upward' : pct < 0 ? 'downward' : 'neutral',
    percentage: Math.abs(Number(pct.toFixed(1))),
  };
};

/** Midnight UTC of the day `daysBack` days before `now`. */
export const utcDayStart = (now: Date, daysBack: number): Date => {
  const day = new Date(now);
  day.setUTCHours(0, 0, 0, 0);
  day.setUTCDate(day.getUTCDate() - daysBack);
  return day;
};

/**
 * Expand sparse per-day counts into a dense series of the last `days` days
 * (oldest first). Keys are `YYYY-MM-DD` in UTC, matching what
 * `date_trunc('day', … AT TIME ZONE 'UTC')` produces.
 */
export const fillDailySeries = (
  counts: Map<string, number>,
  now: Date,
  days: number,
): { count: number; day: string }[] => {
  const series: { count: number; day: string }[] = [];
  for (let back = days - 1; back >= 0; back--) {
    const day = utcDayStart(now, back).toISOString().slice(0, 10);
    series.push({ count: counts.get(day) ?? 0, day });
  }
  return series;
};
