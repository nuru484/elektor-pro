// One graphite block carrying the trust argument: the claim in display type,
// the ballot chain as the single visual that shows what "tamper-evident"
// concretely means, and the four guarantees beside it.

/* Decorative mock with sample data; the guarantee copy carries the actual
   claims, so the diagram is aria-hidden. */
function BallotChain() {
  const BLOCKS = [
    { hash: "8f2a…c41d", prev: "77ae…9b03", seq: "2539" },
    { hash: "d310…55e8", prev: "8f2a…c41d", seq: "2540" },
    { hash: "42bc…a1f7", prev: "d310…55e8", seq: "2541" },
  ];
  return (
    <div aria-hidden className="mt-12 max-w-sm">
      <p className="font-mono text-[10px] tracking-[0.14em] uppercase text-ink-foreground/55">
        Ballot chain &middot; latest entries
      </p>
      <div className="mt-3">
        {BLOCKS.map((block, index) => (
          <div key={block.seq}>
            {/* Connector: each ballot's hash feeds the next one's `prev`. */}
            {index > 0 && (
              <span className="ml-6 block h-4 w-px bg-ink-foreground/25" />
            )}
            <div className="border border-ink-foreground/20 px-4 py-2.5 font-mono text-[11px] leading-relaxed">
              <p className="flex justify-between gap-3">
                <span className="text-ink-foreground/60">
                  Ballot {block.seq}
                </span>
                <span className="text-ink-foreground">{block.hash}</span>
              </p>
              <p className="flex justify-between gap-3 text-ink-foreground/60">
                <span>prev</span>
                <span>{block.prev}</span>
              </p>
            </div>
          </div>
        ))}
        <span className="ml-6 block h-4 w-px bg-ink-foreground/25" />
        <p className="flex items-center gap-2 border border-brand-bright bg-brand-bright/15 px-4 py-2.5 font-mono text-[11px] font-bold text-ink-foreground">
          <svg
            className="size-3.5 flex-none text-brand-bright"
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
    <section className="scroll-mt-24 py-20 md:py-28" id="security">
      <div className="mx-auto w-full max-w-[100rem] px-5 md:px-8 lg:px-12">
        <div
          data-reveal="scale"
          className="bg-ink px-6 py-16 text-ink-foreground md:px-12 md:py-20 lg:px-16 lg:py-24"
        >
          <p className="font-mono text-[11px] font-medium tracking-[0.2em] uppercase text-brand-bright">
            Security
          </p>

          <div className="mt-6 grid gap-12 lg:grid-cols-2 lg:gap-20">
            <div>
              <h2 className="display max-w-[14ch] text-[clamp(2rem,5vw,4.5rem)]">
                Trust is the whole product
              </h2>
              <p className="mt-7 max-w-md text-lg leading-relaxed text-ink-foreground/75">
                A disputed election costs more than any software. Elektor Pro is
                engineered so that even the losing side can check the math - and
                agree with the outcome.
              </p>
              <BallotChain />
            </div>

            <div className="flex flex-col">
              {GUARANTEES.map((item) => (
                <div
                  className="border-t border-ink-foreground/20 py-8 last:border-b"
                  key={item.title}
                >
                  <h3 className="font-display text-2xl font-medium md:text-3xl">
                    {item.title}
                  </h3>
                  <p className="mt-3 max-w-md text-lg leading-relaxed text-ink-foreground/70">
                    {item.body}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
