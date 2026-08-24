import { cssVars } from "@/utils/css-vars";

// Four steps as full-width hairline rows - oversized index numeral, title,
// body - headed by a lifecycle strip of four mock product stills, one per
// step, joined by the hairline their nodes sit on.

/* Decorative mock stills with sample data; each restates its step's copy,
   so the strip is aria-hidden. */
function StageFrame({
  children,
  label,
  live,
}: {
  children: React.ReactNode;
  label: string;
  live?: boolean;
}) {
  return (
    <div className="relative flex flex-col gap-2 border border-border bg-card px-4 pt-5 pb-4">
      {/* Node on the connecting hairline. */}
      <span className="absolute -top-[5px] left-4 flex size-2.5 items-center justify-center">
        {live ? (
          <>
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand opacity-60" />
            <span className="relative inline-flex size-2.5 rounded-full bg-brand" />
          </>
        ) : (
          <span className="size-2.5 rounded-full border-2 border-brand bg-background" />
        )}
      </span>
      <p className="font-mono text-[10px] tracking-[0.14em] uppercase text-muted-foreground">
        {label}
      </p>
      {children}
    </div>
  );
}

function LifecycleStrip() {
  return (
    <div aria-hidden className="relative">
      {/* The hairline the four stage nodes sit on. */}
      <span className="absolute inset-x-2 top-0 hidden h-px bg-border lg:block" />
      <div className="grid grid-cols-1 gap-4 pt-1 sm:grid-cols-2 lg:grid-cols-4">
        <StageFrame label="Register imported">
          <div className="font-mono text-[11px] leading-relaxed text-muted-foreground">
            <p className="flex justify-between gap-2">
              <span>voters.csv</span>
              <span className="text-foreground">2,588 rows</span>
            </p>
            <p className="flex justify-between gap-2">
              <span>Eligible</span>
              <span className="text-brand">2,541</span>
            </p>
            <p className="flex justify-between gap-2">
              <span>Duplicates</span>
              <span className="text-foreground">47 skipped</span>
            </p>
          </div>
        </StageFrame>

        <StageFrame label="Polls open">
          <div className="font-mono text-[11px] leading-relaxed text-muted-foreground">
            <p>
              Window <span className="text-foreground">08:00 - 17:00</span>
            </p>
            <p>
              Codes issued <span className="text-foreground">2,541</span>
            </p>
            <p className="text-brand">Ballot live on every phone</p>
          </div>
        </StageFrame>

        <StageFrame label="Counting live" live>
          <div className="flex flex-col gap-1.5 pt-0.5">
            {[
              { lead: true, pct: 54 },
              { lead: false, pct: 33 },
              { lead: false, pct: 13 },
            ].map(({ lead, pct }) => (
              <div className="h-1.5 overflow-hidden bg-muted" key={pct}>
                <div
                  className={`h-full ${lead ? "bg-brand" : "bg-muted-foreground/40"}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            ))}
            <p className="font-mono text-[11px] text-muted-foreground">
              1,560 of 2,541 voted &middot; 61.4%
            </p>
          </div>
        </StageFrame>

        <StageFrame label="Certified">
          <div className="flex items-center gap-2.5">
            <span className="flex-none border-2 border-brand px-1.5 py-0.5 font-mono text-[10px] font-bold tracking-[0.14em] uppercase text-brand">
              Certified
            </span>
            <p className="min-w-0 font-mono text-[11px] leading-relaxed text-muted-foreground">
              Sealed record
              <span className="block truncate text-foreground">
                88C1 &middot; final
              </span>
            </p>
          </div>
        </StageFrame>
      </div>
    </div>
  );
}

const STEPS = [
  {
    body: "Create the election, add positions and candidates, and import your voter register from a spreadsheet. Scope any position to the right constituency.",
    title: "Set it up",
  },
  {
    body: "Voters get a one-time code, see exactly the ballot they are eligible for, and vote from any phone or computer - or at a supervised polling station.",
    title: "Open the polls",
  },
  {
    body: "Follow turnout and tallies live. Candidate agents watch the same numbers in real time, so nobody is left guessing.",
    title: "Watch it live",
  },
  {
    body: "Close the election, certify the final count into a sealed record, and publish results with proof behind every number.",
    title: "Certify and publish",
  },
];

export function HowItWorks() {
  return (
    <section className="scroll-mt-24 py-20 md:py-28" id="how-it-works">
      <div className="mx-auto w-full max-w-[100rem] px-5 md:px-8 lg:px-12">
        <h2
          data-reveal
          className="display max-w-[12ch] text-[clamp(2rem,5vw,4.5rem)]"
        >
          How it works
        </h2>

        <div className="mt-12 md:mt-16" data-reveal="scale">
          <LifecycleStrip />
        </div>

        <ol className="mt-16 md:mt-20">
          {STEPS.map((step, index) => (
            <li
              data-reveal-item
              style={cssVars({ "--i": index })}
              className="group grid grid-cols-1 gap-3 border-t border-border py-9 last:border-b sm:grid-cols-[7rem_1fr] sm:gap-8 lg:grid-cols-[9rem_minmax(0,1fr)_minmax(0,1.15fr)]"
              key={step.title}
            >
              <span className="font-display text-2xl font-medium text-muted-foreground/50 transition-colors group-hover:text-brand sm:text-3xl md:text-4xl">
                {(index + 1).toString().padStart(2, "0")}
              </span>
              <h3 className="font-display text-2xl font-medium md:text-3xl">
                {step.title}
              </h3>
              <p className="text-lg leading-relaxed text-muted-foreground sm:col-start-2 lg:col-start-3">
                {step.body}
              </p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
