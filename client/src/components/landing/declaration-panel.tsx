"use client";

// The hero's product visual: a certified result declaration. A finished,
// sealed count - kicker, serial, meta strip, tallies with dotted leaders and
// hairline gauges, an audit footer and the certification seal stamped over
// the corner. On load the gauges paint and the counts tick up; reduced
// motion renders the final state instantly (the seal/rise CSS lives in
// globals.css next to the other hero load-sequence rules).
import { useEffect, useState } from "react";

const BAR_DELAY_MS = 380;
const COUNT_DURATION_MS = 1000;

interface TallyRow {
  lead: boolean;
  name: string;
  pct: number;
  votes: number;
}

const TALLY: TallyRow[] = [
  { lead: true, name: "Adwoa Boateng", pct: 52.3, votes: 1322 },
  { lead: false, name: "Kwame Mensah", pct: 37.8, votes: 954 },
  { lead: false, name: "Yaw Darko", pct: 9.9, votes: 251 },
];

const META: [string, string][] = [
  ["Polls closed", "02 Aug, 17:00"],
  ["Valid votes", "2,527"],
  ["Turnout", "80.2%"],
];

export function DeclarationPanel() {
  const [painted, setPainted] = useState(false);
  // One eased 0..1 progress drives all three count-ups in lockstep.
  const [countProgress, setCountProgress] = useState(0);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setCountProgress(1);
      setPainted(true);
      return;
    }
    const barTimer = setTimeout(() => setPainted(true), BAR_DELAY_MS);
    const start = performance.now();
    let frame = requestAnimationFrame(function tick(now) {
      const p = Math.min((now - start) / COUNT_DURATION_MS, 1);
      setCountProgress(1 - Math.pow(1 - p, 3));
      if (p < 1) frame = requestAnimationFrame(tick);
    });
    return () => {
      clearTimeout(barTimer);
      cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <div className="relative">
      <article
        aria-labelledby="declaration-title"
        className="relative bg-card p-6 text-card-foreground shadow-[0_24px_60px_-30px_oklch(0.15_0.05_260_/_0.6)] md:p-8"
      >
        {/* One thin rule under the header - the only line above the footer,
            everything else separates by whitespace. */}
        <header className="flex flex-col gap-4 border-b border-foreground/40 pb-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="font-mono text-[11px] font-bold tracking-[0.18em] uppercase text-brand">
              Certified declaration
            </p>
            <h2
              className="mt-1.5 font-display text-2xl font-semibold leading-tight"
              id="declaration-title"
            >
              General Election &middot; President
            </h2>
          </div>
          <p className="font-mono text-xs leading-normal text-muted-foreground sm:whitespace-nowrap sm:text-right">
            Serial
            <b className="block tracking-[0.04em] text-foreground">
              7Q4K-9XPM-2R8T
            </b>
          </p>
        </header>

        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 pt-4 sm:grid-cols-3">
          {META.map(([label, value]) => (
            <div key={label}>
              <dt className="font-mono text-[10px] tracking-[0.13em] uppercase text-muted-foreground">
                {label}
              </dt>
              <dd className="mt-1 font-mono text-base font-bold tabular-nums">
                {value}
              </dd>
            </div>
          ))}
        </dl>

        <ol className="pt-6 pb-2">
          {TALLY.map((row) => (
            <li className="mt-5 first:mt-0" key={row.name}>
              <div className="flex items-baseline justify-between gap-3">
                <span className="min-w-0 truncate font-display text-lg font-semibold">
                  {row.name}
                </span>
                <span className="flex-none font-mono text-xs tabular-nums text-muted-foreground">
                  <b
                    className={`text-sm ${row.lead ? "text-brand" : "text-foreground"}`}
                  >
                    {Math.round(row.votes * countProgress).toLocaleString("en-US")}
                  </b>{" "}
                  · {row.pct.toFixed(1)}%
                </span>
              </div>
              <div
                aria-label={`${row.name}, ${row.votes.toLocaleString("en-US")} votes, ${row.pct} percent`}
                aria-valuemax={100}
                aria-valuemin={0}
                aria-valuenow={row.pct}
                className="mt-2 h-1.5 overflow-hidden bg-muted"
                role="progressbar"
              >
                <div
                  className={`h-full transition-[width] duration-1000 ease-out ${
                    row.lead ? "bg-brand" : "bg-muted-foreground/40"
                  }`}
                  style={{ width: painted ? `${row.pct}%` : "0%" }}
                />
              </div>
            </li>
          ))}
        </ol>

        {/* pr reserves the corner the seal stamps over, so no text is covered. */}
        <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-4 pr-24 font-mono text-xs text-muted-foreground md:pr-28">
          {/* Plain spaces only: on ~280px folds an unbreakable chunk here
              would push past the panel padding. */}
          <span>
            Ballots cast <b className="text-foreground">2,541</b> · Rejected{" "}
            <b className="text-foreground">14</b>
          </span>
          <span className="inline-flex items-center gap-1.5 text-success">
            <svg aria-hidden className="size-3" fill="none" viewBox="0 0 13 13">
              <path
                d="M1.5 6.8 4.7 10l6.8-7.2"
                stroke="currentColor"
                strokeLinecap="square"
                strokeWidth="1.8"
              />
            </svg>
            Audit chain intact
          </span>
        </footer>

        {/* Certification seal - stamps in after the counts settle. Kept
            minimal: one ring, the circular legend, the date. */}
        <svg
          aria-label="Certified, audit chain intact"
          className="hero-seal pointer-events-none absolute right-3 -bottom-8 w-[92px] text-brand md:right-4 md:w-[112px]"
          role="img"
          viewBox="0 0 200 200"
        >
          <defs>
            <path
              d="M100,100 m-72,0 a72,72 0 1,1 144,0 a72,72 0 1,1 -144,0"
              fill="none"
              id="declaration-seal-ring"
            />
          </defs>
          <circle
            cx="100"
            cy="100"
            fill="var(--card)"
            r="90.5"
            stroke="currentColor"
            strokeWidth="2.5"
          />
          <text
            className="font-mono font-bold"
            fill="currentColor"
            fontSize="15"
            letterSpacing="4"
          >
            <textPath
              href="#declaration-seal-ring"
              startOffset="50%"
              textAnchor="middle"
            >
              CERTIFIED · AUDIT CHAIN INTACT ·
            </textPath>
          </text>
          {/* Center mark instead of a date: the seal certifies, the panel
              itself carries the facts. */}
          <path
            d="M78 102l15 15 30-32"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="7"
          />
        </svg>
        <p className="mt-4 border-t border-border pt-3 pr-24 font-mono text-[10px] tracking-[0.09em] uppercase text-muted-foreground md:pr-28">
          Sample election. Figures are illustrative.
        </p>
      </article>
    </div>
  );
}
