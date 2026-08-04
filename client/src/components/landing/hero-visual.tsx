"use client";

// The hero: a live election board. Every ~2s a ballot drops into the box
// (the brand motif), the count ticks up, the leading tallies shift, and the
// turnout ring advances - the product explaining itself without copy.
// Pure CSS keyframes + a light interval; the global prefers-reduced-motion
// rule freezes it for users who ask.
import { BadgeCheck } from "lucide-react";
import { useEffect, useState } from "react";

const CYCLE_MS = 2000;
const ELIGIBLE = 3150;

interface CandidateRow {
  name: string;
  votes: number;
}

const START: CandidateRow[] = [
  { name: "Adwoa Boateng", votes: 1284 },
  { name: "Kwame Mensah", votes: 938 },
  { name: "Yaw Darko", votes: 247 },
];

/** The ballot box with a slip dropping in, built from plain elements. */
function BallotBox() {
  return (
    <div className="relative mx-auto flex w-36 flex-col items-center">
      {/* Drop zone - clipped so the slip vanishes "into" the slot. */}
      <div className="relative h-24 w-20 overflow-hidden">
        <div
          className="absolute inset-x-2 top-2 h-16 rounded-md border border-border bg-secondary shadow-sm"
          style={{ animation: `ballot-drop ${CYCLE_MS}ms ease-in-out infinite` }}
        >
          <svg
            aria-hidden
            className="absolute top-3 left-1/2 size-7 -translate-x-1/2 text-brand"
            fill="none"
            viewBox="0 0 24 24"
          >
            <path
              d="M5 13l4 4L19 7"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2.5"
            />
          </svg>
        </div>
      </div>
      {/* Box lid with slot */}
      <div className="relative z-10 -mt-1 w-full rounded-t-lg border border-border bg-card px-4 pt-3 pb-2">
        <div
          className="mx-auto h-1.5 w-16 rounded-full"
          style={{ animation: `slot-glow ${CYCLE_MS}ms ease-in-out infinite` }}
        />
      </div>
      {/* Box body */}
      <div className="z-10 h-16 w-[88%] rounded-b-lg border border-t-0 border-border bg-card" />
    </div>
  );
}

/** SVG turnout ring; the arc advances as votes land. */
function TurnoutRing({ turnoutPct }: { turnoutPct: number }) {
  const radius = 30;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - turnoutPct / 100);
  return (
    <div className="relative inline-flex items-center justify-center">
      <svg aria-hidden className="size-24 -rotate-90" viewBox="0 0 72 72">
        <circle
          className="stroke-muted"
          cx="36"
          cy="36"
          fill="none"
          r={radius}
          strokeWidth="6"
        />
        <circle
          className="stroke-brand transition-[stroke-dashoffset] duration-700 ease-out"
          cx="36"
          cy="36"
          fill="none"
          r={radius}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          strokeWidth="6"
        />
      </svg>
      <div className="absolute text-center">
        <p className="text-lg font-semibold tabular-nums">{turnoutPct.toFixed(1)}%</p>
        <p className="text-[10px] text-muted-foreground">turnout</p>
      </div>
    </div>
  );
}

export function HeroVisual() {
  const [rows, setRows] = useState<CandidateRow[]>(START);

  // Every cycle one ballot "lands": weighted toward the leader so the race
  // stays realistic, never reshuffling the order.
  useEffect(() => {
    const interval = setInterval(() => {
      setRows((prev) => {
        const pick = Math.random();
        const index = pick < 0.55 ? 0 : pick < 0.85 ? 1 : 2;
        return prev.map((row, i) =>
          i === index ? { ...row, votes: row.votes + 1 } : row,
        );
      });
    }, CYCLE_MS);
    return () => clearInterval(interval);
  }, []);

  const totalVotes = rows.reduce((sum, row) => sum + row.votes, 0);
  const maxVotes = Math.max(...rows.map((row) => row.votes));
  const turnoutPct = Math.min(100, (totalVotes / ELIGIBLE) * 100);

  return (
    <div
      aria-label="Live election preview: ballots being cast and counted in real time"
      className="mx-auto w-full max-w-4xl select-none rounded-2xl border border-border bg-card/70 backdrop-blur-sm"
      role="img"
    >
      {/* Board header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4 sm:px-7">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">SRC General Election · President</p>
          <p className="text-xs text-muted-foreground">
            <span className="tabular-nums">{totalVotes.toLocaleString()}</span> votes counted
          </p>
        </div>
        <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-success/40 px-2.5 py-1 text-[11px] font-medium text-success">
          <span className="size-1.5 animate-pulse rounded-full bg-success" /> Live
        </span>
      </div>

      {/* Board body: tallies · ballot box · turnout */}
      <div className="grid items-center gap-8 px-5 py-6 sm:px-7 md:grid-cols-[1.2fr_auto_auto] md:gap-10">
        <div className="space-y-4">
          {rows.map((row, index) => (
            <div key={row.name}>
              <div className="mb-1.5 flex items-baseline justify-between gap-3 text-sm">
                <span className="min-w-0 truncate font-medium">{row.name}</span>
                <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                  {row.votes.toLocaleString()} · {((row.votes / totalVotes) * 100).toFixed(0)}%
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className={
                    index === 0
                      ? "h-full rounded-full bg-brand transition-[width] duration-700 ease-out"
                      : "h-full rounded-full bg-muted-foreground/30 transition-[width] duration-700 ease-out"
                  }
                  style={{ width: `${(row.votes / maxVotes) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>

        <BallotBox />

        <div className="justify-self-center">
          <TurnoutRing turnoutPct={turnoutPct} />
        </div>
      </div>

      {/* Receipt strip */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-5 py-3.5 sm:px-7">
        <div
          className="flex min-w-0 items-center gap-2"
          style={{ animation: `chip-pop ${CYCLE_MS}ms ease-in-out infinite` }}
        >
          <BadgeCheck className="size-4 shrink-0 text-success" />
          <span className="truncate font-mono text-xs text-muted-foreground">
            7Q4K-9XPM-2R8T · ballot verified
          </span>
        </div>
        <span className="text-xs text-muted-foreground">Audit chain intact</span>
      </div>
    </div>
  );
}
