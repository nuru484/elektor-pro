import { ArrowRight, BadgeCheck } from "lucide-react";
import Link from "next/link";

/**
 * The hero's product visual: a flat live-results panel with a smaller
 * "ballot verified" card overlapping it. Real product surfaces rebuilt as
 * lightweight markup - hairline borders, no glows, no gradients.
 */
function ProductVisual() {
  const rows = [
    { name: "Adwoa Boateng", pct: 52, votes: "1,284" },
    { name: "Kwame Mensah", pct: 38, votes: "938" },
    { name: "Yaw Darko", pct: 10, votes: "247" },
  ];
  return (
    <div aria-hidden className="relative mx-auto w-full max-w-md select-none lg:mx-0">
      {/* Live results panel */}
      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="flex items-center justify-between gap-3 border-b border-border pb-4">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">SRC General Election</p>
            <p className="text-xs text-muted-foreground">President · 2,469 votes · 78% turnout</p>
          </div>
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-success/40 px-2.5 py-1 text-[11px] font-medium text-success">
            <span className="size-1.5 animate-pulse rounded-full bg-success" /> Live
          </span>
        </div>
        <div className="mt-4 space-y-4">
          {rows.map((row, index) => (
            <div key={row.name}>
              <div className="mb-1.5 flex items-baseline justify-between gap-3 text-sm">
                <span className="min-w-0 truncate font-medium">{row.name}</span>
                <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                  {row.votes} · {row.pct}%
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className={index === 0 ? "h-full rounded-full bg-brand" : "h-full rounded-full bg-muted-foreground/30"}
                  style={{ width: `${row.pct}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Ballot-verified card, overlapping */}
      <div className="relative z-10 -mt-6 ml-auto w-[78%] rounded-xl border border-border bg-card p-4 sm:w-[70%]">
        <div className="flex items-center gap-3">
          <BadgeCheck className="size-5 shrink-0 text-success" />
          <div className="min-w-0">
            <p className="text-sm font-medium">Ballot verified</p>
            <p className="truncate font-mono text-xs text-muted-foreground">
              7Q4K-9XPM-2R8T · counted · chain intact
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export function Hero() {
  return (
    <section className="mx-auto mb-24 max-w-6xl pt-10 md:mb-32 md:pt-16">
      <div className="px-6 md:px-10">
        <div className="grid items-center gap-12 lg:grid-cols-[1.05fr_0.95fr]">
          <div>
            <p className="text-lg text-muted-foreground">
              The e-voting platform for organizations
            </p>

            {/* Fluid size so long words fit a 280px viewport without breaks. */}
            <h1 className="mt-6 text-[clamp(2.1rem,10.5vw,3rem)] font-medium leading-[1.08] tracking-normal md:text-6xl">
              Elections everyone trusts.{" "}
              <span className="text-muted-foreground/60">
                Start to certified finish.
              </span>
            </h1>

            <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground">
              Secret ballots, live tallies, and proof behind every vote - for
              universities, unions, associations, and companies that cannot
              afford a disputed outcome.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link href="/login">
                <button
                  className="flex items-center justify-center gap-2 whitespace-nowrap rounded-full border border-foreground bg-foreground px-6 py-3 text-base font-medium text-background transition-colors duration-500 ease-in-out hover:bg-transparent hover:text-foreground md:px-7 md:py-3.5 md:text-lg"
                  type="button"
                >
                  Start an election <ArrowRight className="size-5" />
                </button>
              </Link>
              <Link href="/vote">
                <button
                  className="flex items-center justify-center gap-2 whitespace-nowrap rounded-full border border-foreground bg-transparent px-6 py-3 text-base font-medium text-foreground transition-colors duration-500 ease-in-out hover:bg-foreground hover:text-background md:px-7 md:py-3.5 md:text-lg"
                  type="button"
                >
                  Cast your vote
                </button>
              </Link>
            </div>
          </div>

          <ProductVisual />
        </div>

        {/* Hairline claims row - plain type, no badges, no icons. */}
        <dl className="mt-16 grid max-w-3xl grid-cols-1 divide-y divide-border border-y border-border sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          {[
            ["Secret ballots", "never linked to the voter"],
            ["Live results", "as every vote lands"],
            ["Verifiable outcomes", "receipts prove the count"],
          ].map(([claim, detail], index) => (
            <div
              className={index === 0 ? "py-5 sm:pr-8" : index === 1 ? "py-5 sm:px-8" : "py-5 sm:pl-8"}
              key={claim}
            >
              <dt className="text-lg font-medium">{claim}</dt>
              <dd className="mt-0.5 text-muted-foreground">{detail}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
