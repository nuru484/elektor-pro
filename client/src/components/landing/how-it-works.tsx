const STEPS = [
  {
    body: "Create the election, add positions and candidates, and import your voter register from a spreadsheet. Scope any position to the right constituency.",
    title: "Set it up",
  },
  {
    body: "Voters get a one-time code, see exactly the ballot they're eligible for, and vote from any phone or computer - or at a supervised polling station.",
    title: "Open the polls",
  },
  {
    body: "Follow turnout and tallies live. Candidate agents watch the same numbers in real time, so nobody is left guessing.",
    title: "Watch it live",
  },
  {
    body: "Close the election, certify the final count into a sealed record, and publish results with proof behind every number.",
    title: "Certify & publish",
  },
];

export function HowItWorks() {
  return (
    <section
      className="border-y border-border bg-card/50 scroll-mt-20"
      id="how-it-works"
    >
      <div className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6">
        <div className="max-w-2xl">
          <p className="text-sm font-medium text-brand">How it works</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
            From nominations to certified results in four steps
          </h2>
        </div>
        <ol className="mt-10 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((step, index) => (
            <li className="relative" key={step.title}>
              <div className="flex items-center gap-3">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand text-sm font-semibold text-brand-foreground">
                  {index + 1}
                </span>
                {/* Connector line between steps on wide screens */}
                {index < STEPS.length - 1 && (
                  <span aria-hidden className="hidden h-px flex-1 bg-border lg:block" />
                )}
              </div>
              <h3 className="mt-4 font-medium">{step.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{step.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
