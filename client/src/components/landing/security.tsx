import { BadgeCheck, CheckCircle2 } from "lucide-react";

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
    body: "Voters can check their receipt code at any time to confirm their ballot is in the count - without exposing who they voted for.",
    title: "Voter-verifiable results",
  },
];

export function Security() {
  return (
    <section className="mx-auto w-full max-w-6xl scroll-mt-20 px-4 py-20 sm:px-6" id="security">
      <div className="grid items-center gap-12 lg:grid-cols-2">
        <div>
          <p className="text-sm font-medium text-brand">Security</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
            Trust isn&apos;t a feature. It&apos;s the whole product.
          </h2>
          <p className="mt-3 leading-relaxed text-muted-foreground">
            A disputed election costs more than any software. Elektor Pro is
            engineered so that the losing side can check the math - and agree
            with the outcome.
          </p>
          <ul className="mt-8 space-y-5">
            {GUARANTEES.map((item) => (
              <li className="flex gap-3" key={item.title}>
                <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-success" />
                <div>
                  <p className="font-medium">{item.title}</p>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                    {item.body}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        {/* Receipt-verification mock */}
        <div aria-hidden className="relative mx-auto w-full max-w-sm select-none">
          <div className="absolute -inset-6 rounded-3xl bg-brand/5 blur-2xl" />
          <div className="relative rounded-2xl border border-border bg-card p-6 shadow-sm">
            <p className="text-sm font-semibold">Verify your ballot</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Enter the receipt code from your confirmation screen.
            </p>
            <div className="mt-4 rounded-lg border border-border bg-muted/40 px-4 py-3 text-center font-mono text-sm tracking-widest">
              7Q4K-9XPM-2R8T
            </div>
            <div className="mt-4 flex items-center gap-3 rounded-lg border border-success/30 bg-success/8 px-4 py-3">
              <BadgeCheck className="size-5 shrink-0 text-success" />
              <div>
                <p className="text-sm font-medium text-success">Ballot verified</p>
                <p className="text-xs text-muted-foreground">
                  Counted · integrity intact · #1,284 in the chain
                </p>
              </div>
            </div>
            <p className="mt-4 text-center text-[11px] text-muted-foreground">
              Verification never reveals who you voted for.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
