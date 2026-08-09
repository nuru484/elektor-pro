"use client";

// Chart pieces for the visual results view. Hand-rolled SVG/CSS rather than a
// chart library: the shapes are simple, the data is small and fully known at
// render time, and this keeps the client bundle (and a voter's data bill) as
// it was. Every chart pairs its marks with printed numbers, so nothing is
// readable by color or length alone.
import type { CandidateResult, PortfolioResult } from "@/types/api";

const fmt = (n: number) => n.toLocaleString();

/** Series colors, assigned in fixed order - never by rank, never cycled. */
const SERIES = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
];
/** Anything past the named series shares the reserved neutral. */
const OTHER = "var(--chart-5)";

export const seriesColor = (index: number): string =>
  index < SERIES.length ? SERIES[index] : OTHER;

/**
 * Ranked horizontal bars - the workhorse for "who got how many votes".
 * Bars are thin, labelled in place, and carry the exact count, so the chart
 * answers the question without a legend or a tooltip.
 */
export function VoteBars({ candidates }: { candidates: CandidateResult[] }) {
  const max = Math.max(...candidates.map((c) => c.votes), 1);
  return (
    <ol className="space-y-3">
      {candidates.map((candidate, index) => (
        <li key={candidate.id}>
          {/* Names wrap rather than clamp: a long name, or a field of many
              candidates, must stay readable - the bar below is what carries
              the comparison, so extra label lines cost nothing. */}
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
            <span className="min-w-0 text-sm font-medium [overflow-wrap:anywhere]">
              {candidate.name}
            </span>
            <span className="flex-none font-mono text-xs tabular-nums text-muted-foreground">
              <b className="text-foreground">{fmt(candidate.votes)}</b> ·{" "}
              {candidate.percentage}%
            </span>
          </div>
          <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full transition-[width] duration-700"
              style={{
                background: seriesColor(index),
                width: `${(candidate.votes / max) * 100}%`,
              }}
            />
          </div>
        </li>
      ))}
    </ol>
  );
}

/**
 * Vote share as a donut. Share-of-whole is the one question a pie answers
 * better than a bar, and it is exactly the question a contested race raises
 * ("did anyone clear half?"), so the 50% mark is drawn on the ring.
 */
export function ShareDonut({
  candidates,
  size = 168,
}: {
  candidates: CandidateResult[];
  size?: number;
}) {
  const total = candidates.reduce((sum, c) => sum + c.votes, 0);
  if (total === 0) return null;

  const radius = size / 2 - 14;
  const circumference = 2 * Math.PI * radius;
  // Each segment starts where the previous ones ended. Precomputed rather
  // than accumulated during render, so the map callback stays pure.
  const segments = candidates.reduce<
    { candidate: CandidateResult; dash: number; offset: number }[]
  >((acc, candidate) => {
    const previous = acc.at(-1);
    const offset = previous ? previous.offset + previous.dash : 0;
    acc.push({
      candidate,
      dash: (candidate.votes / total) * circumference,
      offset,
    });
    return acc;
  }, []);

  return (
    <figure className="flex flex-col items-center gap-3">
      <svg
        aria-hidden
        className="-rotate-90"
        height={size}
        role="presentation"
        viewBox={`0 0 ${size} ${size}`}
        width={size}
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          fill="none"
          r={radius}
          stroke="var(--muted)"
          strokeWidth={16}
        />
        {segments.map(({ candidate, dash, offset }, index) => (
          <circle
            cx={size / 2}
            cy={size / 2}
            fill="none"
            key={candidate.id}
            r={radius}
            stroke={seriesColor(index)}
            // The 2px gap is what keeps adjacent segments distinguishable
            // when two candidates run neck and neck.
            strokeDasharray={`${Math.max(dash - 2, 0)} ${circumference}`}
            strokeDashoffset={-offset}
            strokeWidth={16}
          />
        ))}
        {/* The majority line: half the ring, drawn over the segments. */}
        <circle
          cx={size / 2}
          cy={size / 2}
          fill="none"
          r={radius + 10}
          stroke="var(--foreground)"
          strokeDasharray={`2 ${circumference}`}
          strokeDashoffset={-circumference / 2}
          strokeWidth={8}
        />
      </svg>
      <figcaption className="sr-only">
        Vote share by candidate. {candidates.map((c) => `${c.name}: ${c.percentage}%`).join(", ")}.
      </figcaption>
      {/* Legend: identity is never color-alone - each swatch carries its name
          and its exact share. */}
      <ul className="flex flex-wrap justify-center gap-x-4 gap-y-1.5">
        {candidates.map((candidate, index) => (
          <li
            className="flex max-w-full items-baseline gap-1.5 text-xs text-muted-foreground"
            key={candidate.id}
          >
            <span
              className="mt-1 size-2.5 flex-none self-start rounded-full"
              style={{ background: seriesColor(index) }}
            />
            <span className="min-w-0 [overflow-wrap:anywhere]">
              {candidate.name}
            </span>
            <span className="font-mono tabular-nums text-foreground">
              {candidate.percentage}%
            </span>
          </li>
        ))}
      </ul>
    </figure>
  );
}

/** Turnout as a single filled arc plus the counts behind it. */
export function TurnoutGauge({
  percentage,
  totalEligible,
  totalVoted,
}: {
  percentage: number;
  totalEligible: number;
  totalVoted: number;
}) {
  const pct = Math.min(Math.max(percentage, 0), 100);
  return (
    <div className="flex flex-wrap items-center gap-x-8 gap-y-4">
      <div className="min-w-0">
        <p className="font-mono text-4xl font-semibold tabular-nums">{pct}%</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {fmt(totalVoted)} of {fmt(totalEligible)} eligible voters cast a
          ballot
        </p>
      </div>
      <div
        aria-label={`Turnout ${String(pct)} percent`}
        aria-valuemax={100}
        aria-valuemin={0}
        aria-valuenow={Math.round(pct)}
        className="h-2.5 min-w-48 flex-1 overflow-hidden rounded-full bg-muted"
        role="progressbar"
      >
        <div
          className="h-full rounded-full bg-chart-1 transition-[width] duration-700"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

/** Rejected/abstained ballots for a race, when there are any. */
export function NonVoteBreakdown({ portfolio }: { portfolio: PortfolioResult }) {
  const rows = [
    { label: "Abstained", value: portfolio.abstain },
    { label: "Skipped", value: portfolio.skip },
  ].filter((row) => row.value > 0);
  if (rows.length === 0) return null;
  return (
    <p className="mt-4 flex flex-wrap gap-x-4 gap-y-1 border-t border-border pt-3 font-mono text-xs text-muted-foreground">
      {rows.map((row) => (
        <span key={row.label}>
          {row.label} <b className="text-foreground">{fmt(row.value)}</b>
        </span>
      ))}
    </p>
  );
}
