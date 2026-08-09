// Typographic guarantees - heading left, promises right - anchored by one
// visual: a mock slice of the ballot chain (same family as the hero's
// declaration panel), showing what "tamper-evident" concretely means.

/* Decorative mock with sample data; the guarantee copy carries the actual
   claims, so the diagram is aria-hidden. */
function BallotChain() {
  const BLOCKS = [
    { hash: "8f2a…c41d", prev: "77ae…9b03", seq: "2539" },
    { hash: "d310…55e8", prev: "8f2a…c41d", seq: "2540" },
    { hash: "42bc…a1f7", prev: "d310…55e8", seq: "2541" },
  ];
  return (
    <div aria-hidden className="mt-10 max-w-sm">
      <p className="font-mono text-[10px] tracking-[0.14em] uppercase text-muted-foreground">
        Ballot chain &middot; latest entries
      </p>
      <div className="mt-3">
        {BLOCKS.map((block, index) => (
          <div key={block.seq}>
            {/* Connector: each ballot's hash feeds the next one's `prev`. */}
            {index > 0 && <span className="ml-6 block h-4 w-px bg-border" />}
            <div className="rounded-lg border border-border/70 bg-card/60 px-4 py-2.5 font-mono text-[11px] leading-relaxed">
              <p className="flex justify-between gap-3">
                <span className="text-muted-foreground">
                  Ballot {block.seq}
                </span>
                <span className="text-foreground">{block.hash}</span>
              </p>
              <p className="flex justify-between gap-3 text-muted-foreground">
                <span>prev</span>
                <span>{block.prev}</span>
              </p>
            </div>
          </div>
        ))}
        <span className="ml-6 block h-4 w-px bg-border" />
        <p className="flex items-center gap-2 rounded-lg border border-brand/50 bg-brand-muted px-4 py-2.5 font-mono text-[11px] font-bold text-foreground">
          <svg
            className="size-3.5 flex-none text-brand"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2.5"
            viewBox="0 0 24 24"
          >
            <path d="M20 6 9 17l-5-5" />
          </svg>
          Chain intact &middot; every link verified
        </p>
      </div>
    </div>
  );
}

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
          <BallotChain />
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
