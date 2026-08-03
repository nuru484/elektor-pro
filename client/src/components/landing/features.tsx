// Numbered, typography-first feature list (the portfolio's outlined-number
// card pattern) - no icons, no chips.
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
    <div>
      <div className="relative pl-10">
        <div
          className="absolute text-6xl font-semibold opacity-30"
          style={{
            color: "transparent",
            transform: "translate(-100%, -0%) rotate(-90deg)",
            WebkitTextStroke: "1px var(--foreground)",
          }}
        >
          {number.toString().padStart(2, "0")}
        </div>
        <div className="space-y-4">
          <h3 className="text-3xl font-medium">{title}</h3>
          <p className="max-w-md text-lg leading-relaxed text-muted-foreground">{body}</p>
        </div>
      </div>
    </div>
  );
}

export function Features() {
  return (
    <section
      className="mx-auto mb-24 flex max-w-6xl scroll-mt-8 flex-col gap-8 px-6 md:mb-32 md:px-12"
      id="product"
    >
      <h2 className="text-4xl font-medium md:text-5xl">
        Everything an election needs
      </h2>
      <div className="grid grid-cols-1 items-start gap-12 md:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map((feature) => (
          <FeatureCard key={feature.number} {...feature} />
        ))}
      </div>
    </section>
  );
}
