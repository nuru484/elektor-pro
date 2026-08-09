"use client";

// Single-series bars over consecutive days (votes per day). Hand-rolled on
// purpose - one series, fixed domain, no chart library needed. Bars are the
// brand series color; identity is in the title so there is no legend. Each
// bar has a hover/focus tooltip (the hit target is the full column, bigger
// than the mark) and the same data is available as a table for screen
// readers via the sr-only caption list.
import { useState } from "react";

const BAR_MIN_PCT = 2;

const dayLabel = (iso: string): string =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });

export function DailyBars({
  series,
}: {
  series: { count: number; day: string }[];
}) {
  const [active, setActive] = useState<null | number>(null);
  const max = Math.max(...series.map((point) => point.count), 0);

  if (max === 0) {
    return (
      <div className="flex h-full min-h-40 items-center justify-center rounded-lg border-2 border-dashed border-border/60 bg-secondary/30">
        <p className="text-sm text-muted-foreground">
          No ballots cast in this period.
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-40 flex-col">
      <div
        aria-label="Ballots cast per day"
        className="flex min-h-40 flex-1 items-end gap-1"
        role="img"
      >
        {series.map((point, index) => (
          <button
            aria-label={`${dayLabel(point.day)}: ${point.count} ballots`}
            className="group relative flex h-full min-w-0 flex-1 cursor-default items-end rounded-t-sm outline-ring/50 hover:bg-accent/60 focus-visible:bg-accent/60"
            key={point.day}
            onBlur={() => setActive(null)}
            onFocus={() => setActive(index)}
            onMouseEnter={() => setActive(index)}
            onMouseLeave={() => setActive(null)}
            type="button"
          >
            <span
              className="block w-full rounded-t-[4px] bg-chart-1"
              style={{
                height: `${Math.max((point.count / max) * 100, point.count > 0 ? BAR_MIN_PCT : 0)}%`,
              }}
            />
            {active === index && (
              <span className="pointer-events-none absolute -top-1 left-1/2 z-10 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-md border border-border bg-popover px-2 py-1 font-mono text-[11px] text-popover-foreground shadow-sm">
                <b className="tabular-nums">{point.count.toLocaleString()}</b> ·{" "}
                {dayLabel(point.day)}
              </span>
            )}
          </button>
        ))}
      </div>
      <div className="mt-1.5 flex justify-between font-mono text-[10px] text-muted-foreground">
        <span>{dayLabel(series[0].day)}</span>
        <span>{dayLabel(series[series.length - 1].day)}</span>
      </div>
    </div>
  );
}
