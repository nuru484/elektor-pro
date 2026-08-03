// Plain typographic guarantees - heading left, promises right. No mocks,
// no icons, no glows.
const GUARANTEES = [
  {
    body: "One person, one vote - enforced at the database level, not by policy. Double voting is technically impossible.",
    title: "No double voting",
  },
  {
    body: "Ballots are stored anonymously and chained together cryptographically. Altering or removing a single vote breaks the chain visibly.",
    title: "Tamper-evident ballots",
  },
  {
    body: "Every administrative action - by anyone, at any level - is written to an append-only audit trail that can be independently verified.",
    title: "Nobody above the log",
  },
  {
    body: "Voters can check their receipt code at any time to confirm their ballot is in the count, without exposing who they voted for.",
    title: "Voter-verifiable results",
  },
];

export function Security() {
  return (
    <section
      className="mx-auto mb-24 max-w-6xl scroll-mt-8 px-6 md:mb-32 md:px-12"
      id="security"
    >
      <div className="grid grid-cols-1 gap-12 md:grid-cols-2">
        <div className="md:sticky md:top-12 md:self-start">
          <h2 className="text-4xl font-medium md:text-5xl">
            Trust is the{" "}
            <span className="text-muted-foreground/50">whole product</span>
          </h2>
          <p className="mt-6 max-w-md text-lg leading-relaxed text-muted-foreground">
            A disputed election costs more than any software. Elektor Pro is
            engineered so that even the losing side can check the math - and
            agree with the outcome.
          </p>
        </div>
        <div className="flex flex-col gap-10">
          {GUARANTEES.map((item) => (
            <div key={item.title}>
              <h3 className="text-2xl font-medium md:text-3xl">{item.title}</h3>
              <p className="mt-3 max-w-md text-lg leading-relaxed text-muted-foreground">
                {item.body}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
