import {
  calculateTrend,
  fillDailySeries,
  utcDayStart,
} from '#utils/dashboard-window.js';
// Pure dashboard window helpers: trend math and zero-filled daily series.
import { describe, expect, it } from 'vitest';

describe('calculateTrend', () => {
  it('reports growth over a non-zero baseline', () => {
    expect(calculateTrend(150, 100)).toEqual({
      direction: 'upward',
      percentage: 50,
    });
  });

  it('reports decline with a positive percentage', () => {
    expect(calculateTrend(75, 100)).toEqual({
      direction: 'downward',
      percentage: 25,
    });
  });

  it('is neutral when nothing changed', () => {
    expect(calculateTrend(100, 100)).toEqual({
      direction: 'neutral',
      percentage: 0,
    });
  });

  it('treats growth from a zero baseline as +100%', () => {
    expect(calculateTrend(5, 0)).toEqual({
      direction: 'upward',
      percentage: 100,
    });
  });

  it('is neutral when both windows are empty', () => {
    expect(calculateTrend(0, 0)).toEqual({
      direction: 'neutral',
      percentage: 0,
    });
  });

  it('rounds to one decimal place', () => {
    expect(calculateTrend(1, 3).percentage).toBe(66.7);
  });
});

describe('utcDayStart', () => {
  it('returns midnight UTC of the requested day', () => {
    const now = new Date('2026-08-08T15:30:45.123Z');
    expect(utcDayStart(now, 0).toISOString()).toBe('2026-08-08T00:00:00.000Z');
    expect(utcDayStart(now, 7).toISOString()).toBe('2026-08-01T00:00:00.000Z');
  });

  it('crosses month boundaries', () => {
    const now = new Date('2026-03-02T01:00:00.000Z');
    expect(utcDayStart(now, 3).toISOString()).toBe('2026-02-27T00:00:00.000Z');
  });
});

describe('fillDailySeries', () => {
  it('zero-fills missing days, oldest first', () => {
    const now = new Date('2026-08-08T12:00:00.000Z');
    const counts = new Map([
      ['2026-08-06', 4],
      ['2026-08-08', 9],
    ]);
    expect(fillDailySeries(counts, now, 3)).toEqual([
      { count: 4, day: '2026-08-06' },
      { count: 0, day: '2026-08-07' },
      { count: 9, day: '2026-08-08' },
    ]);
  });

  it('returns exactly `days` entries even with no data', () => {
    const series = fillDailySeries(new Map(), new Date(), 14);
    expect(series).toHaveLength(14);
    expect(series.every((point) => point.count === 0)).toBe(true);
  });
});
