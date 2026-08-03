// Four steps as a minimal bordered list - big muted numbers, plain type.
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
    <section
      className="mx-auto mb-24 flex max-w-6xl scroll-mt-8 flex-col gap-8 px-6 md:mb-32 md:px-12"
      id="how-it-works"
    >
      <h2 className="text-4xl font-medium md:text-5xl">How it works</h2>
      <ol>
        {STEPS.map((step, index) => (
          <li
            className="grid grid-cols-1 gap-2 border-t border-border py-8 last:border-b sm:grid-cols-[6rem_1fr] sm:gap-8 md:grid-cols-[8rem_1fr_1.2fr]"
            key={step.title}
          >
            <span className="text-2xl font-semibold text-muted-foreground/50 md:text-3xl">
              {(index + 1).toString().padStart(2, "0")}
            </span>
            <h3 className="text-2xl font-medium md:text-3xl">{step.title}</h3>
            <p className="text-lg leading-relaxed text-muted-foreground sm:col-start-2 md:col-start-3">
              {step.body}
            </p>
          </li>
        ))}
      </ol>
    </section>
  );
}
