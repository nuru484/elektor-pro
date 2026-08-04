import { describe, expect, it } from 'vitest';

import { fixedClock, systemClock } from '../../src/lib/clock.js';

describe('clock', () => {
  it('systemClock tracks the wall clock', () => {
    const before = Date.now();
    const ts = systemClock.timestamp();
    const now = systemClock.now().getTime();
    const after = Date.now();
    expect(ts).toBeGreaterThanOrEqual(before);
    expect(now).toBeGreaterThanOrEqual(before);
    expect(ts).toBeLessThanOrEqual(after);
    expect(now).toBeLessThanOrEqual(after);
  });

  it('fixedClock stays frozen at the given instant', () => {
    const clock = fixedClock('2026-08-03T12:00:00.000Z');
    expect(clock.now().toISOString()).toBe('2026-08-03T12:00:00.000Z');
    expect(clock.timestamp()).toBe(new Date('2026-08-03T12:00:00.000Z').getTime());
  });

  it('fixedClock accepts Date and epoch inputs', () => {
    const instant = new Date('2030-01-01T00:00:00.000Z');
    expect(fixedClock(instant).timestamp()).toBe(instant.getTime());
    expect(fixedClock(instant.getTime()).now().toISOString()).toBe(instant.toISOString());
  });

  it('fixedClock.now() returns a fresh Date each call (mutation-safe)', () => {
    const clock = fixedClock('2026-08-03T12:00:00.000Z');
    const first = clock.now();
    first.setFullYear(1999);
    expect(clock.now().getUTCFullYear()).toBe(2026);
  });
});
