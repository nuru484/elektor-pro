import { ArrowRight, BadgeCheck, Lock, Radio } from "lucide-react";
import Link from "next/link";

/**
 * A stylized live-results card: the product's most recognizable screen,
 * rebuilt as lightweight markup so the hero shows the product without a
 * stale screenshot.
 */
function ResultsPreview() {
  const rows = [
    { name: "Adwoa Boateng", pct: 52, votes: "1,284" },
    { name: "Kwame Mensah", pct: 38, votes: "938" },
    { name: "Yaw Darko", pct: 10, votes: "247" },
  ];
  return (
    <div aria-hidden className="relative mx-auto w-full max-w-md select-none">
      <div className="absolute -inset-6 rounded-3xl bg-brand/5 blur-2xl" />
      <div className="relative rounded-2xl border border-border bg-card p-5 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">SRC General Election</p>
            <p className="text-xs text-muted-foreground">President · 2,469 votes</p>
          </div>
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-success/12 px-2.5 py-1 text-[11px] font-medium text-success">
            <Radio className="size-3 animate-pulse" /> Live
          </span>
        </div>
        <div className="mt-5 space-y-4">
          {rows.map((row, index) => (
            <div key={row.name}>
              <div className="mb-1.5 flex items-baseline justify-between gap-3 text-sm">
                <span className="min-w-0 truncate font-medium">{row.name}</span>
                <span className="shrink-0 tabular-nums text-muted-foreground">
                  {row.votes} · {row.pct}%
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className={index === 0 ? "h-full rounded-full bg-brand" : "h-full rounded-full bg-muted-foreground/30"}
                  style={{ width: `${row.pct}%` }}
                />
              </div>
            </div>
          ))}
        </div>
        <div className="mt-5 flex items-center justify-between rounded-lg border border-dashed border-border bg-muted/40 px-3 py-2">
          <span className="text-[11px] text-muted-foreground">Ballot receipt</span>
          <span className="font-mono text-xs font-medium tracking-wide">7Q4K-9XPM-2R8T</span>
          <BadgeCheck className="size-4 text-success" />
        </div>
      </div>
      {/* Floating turnout chip */}
      <div className="absolute -bottom-5 -left-3 hidden rounded-xl border border-border bg-card px-4 py-2.5 shadow-sm sm:block">
        <p className="text-[11px] text-muted-foreground">Turnout</p>
        <p className="text-sm font-semibold tabular-nums">
          78.4% <span className="font-normal text-success">▲ live</span>
        </p>
      </div>
    </div>
  );
}

export function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-grid opacity-50" />
      <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-4 pb-20 pt-14 sm:px-6 sm:pt-20 lg:grid-cols-[1.1fr_0.9fr] lg:pb-28">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
            <Lock className="size-3 text-brand" />
            The secure e-voting platform for organizations
          </span>
          <h1 className="mt-6 text-[clamp(2.2rem,9vw,3.2rem)] font-semibold leading-[1.08] tracking-tight lg:text-6xl">
            Run elections everyone
            <span className="text-brand"> trusts</span>.
          </h1>
          <p className="mt-5 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
            Elektor Pro takes your elections from nominations to certified
            results - secret ballots, live tallies, and proof for every vote.
            Built for universities, unions, associations, and companies that
            can&apos;t afford a disputed outcome.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              className="inline-flex items-center gap-2 whitespace-nowrap rounded-full bg-brand px-6 py-3 text-sm font-medium text-brand-foreground transition-colors hover:bg-brand/90 sm:px-7 sm:text-base"
              href="/login"
            >
              Start an election <ArrowRight className="size-4" />
            </Link>
            <Link
              className="inline-flex items-center gap-2 whitespace-nowrap rounded-full border border-border bg-background px-6 py-3 text-sm font-medium transition-colors hover:bg-accent sm:px-7 sm:text-base"
              href="/vote"
            >
              I&apos;m here to vote
            </Link>
          </div>
          <dl className="mt-12 grid max-w-md grid-cols-3 gap-4 border-t border-border pt-6">
            {[
              ["100%", "secret ballots"],
              ["Live", "result tallies"],
              ["Every vote", "verifiable"],
            ].map(([stat, label]) => (
              <div key={label}>
                <dt className="text-lg font-semibold sm:text-xl">{stat}</dt>
                <dd className="mt-0.5 text-xs text-muted-foreground">{label}</dd>
              </div>
            ))}
          </dl>
        </div>
        <ResultsPreview />
      </div>
    </section>
  );
}
