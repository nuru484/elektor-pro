// Feature grid as clean bordered cards - Elektor's own take on the shared
// language (hairlines, muted type, quiet numbering), distinct from the
// portfolio's outlined-number signature. Each card carries a mono index, a
// brand top rule that brightens on hover, title, and body.
interface Feature {
  body: string;
  number: number;
  title: string;
}

const FEATURES: Feature[] = [
  {
    body: "Ballots are never linked to the voter. Each voter walks away with a private receipt code that proves their vote was counted, without revealing their choice to anyone.",
    number: 1,
    title: "Secret ballots with proof",
  },
  {
    body: "Watch turnout and tallies update the moment votes land. You decide who sees results - live for everyone, on close, or only when officially published.",
    number: 2,
    title: "Results as they happen",
  },
  {
    body: "Sensitive changes go through approval before they take effect, and every action - including the administrators' own - lands in a tamper-evident audit trail.",
    number: 3,
    title: "Four-eyes governance",
  },
  {
    body: "Presidents, secretaries, referenda; campus-wide races or seats scoped to a faculty, hall, or branch. If your constitution allows it, you can run it.",
    number: 4,
    title: "Any election, any structure",
  },
  {
    body: "Voters sign in with a one-time code to their phone or email - no passwords to forget on election day. Staff accounts carry two-factor authentication.",
    number: 5,
    title: "Sign-in that just works",
  },
  {
    body: "Close the election, certify the outcome into a sealed official record, and export results ready to publish. The numbers cannot quietly change afterwards.",
    number: 6,
    title: "Certified, final outcomes",
  },
];

function FeatureCard({ body, number, title }: Feature) {
  return (
    <div className="group relative flex flex-col gap-3 overflow-hidden rounded-2xl border border-border bg-card/60 p-7 transition-colors hover:border-brand/50">
      {/* Brand top rule that brightens on hover. */}
      <span
        aria-hidden
        className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-brand/60 to-transparent opacity-40 transition-opacity group-hover:opacity-100"
      />
      <span className="font-mono text-xs tracking-[0.18em] text-muted-foreground/70">
        {number.toString().padStart(2, "0")}
      </span>
      <h3 className="text-xl font-medium leading-snug md:text-2xl">{title}</h3>
      <p className="leading-relaxed text-muted-foreground">{body}</p>
    </div>
  );
}

export function Features() {
  return (
    <section
      className="mx-auto mb-24 flex max-w-6xl scroll-mt-8 flex-col gap-8 px-6 md:mb-32 md:px-10"
      id="product"
    >
      <div className="max-w-2xl">
        <h2 className="text-4xl font-medium md:text-5xl">
          Everything an election needs
        </h2>
        <p className="mt-4 text-lg leading-relaxed text-muted-foreground">
          One platform carries your election end to end - no spreadsheets, no
          paper trails, no arguments about the count.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map((feature) => (
          <FeatureCard key={feature.number} {...feature} />
        ))}
      </div>
    </section>
  );
}
