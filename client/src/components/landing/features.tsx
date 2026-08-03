import {
  BarChart3,
  FileCheck2,
  Fingerprint,
  Lock,
  ShieldCheck,
  UsersRound,
} from "lucide-react";

const FEATURES = [
  {
    body: "Ballots are never linked to the voter. Each voter walks away with a private receipt code that proves their vote was counted - without revealing their choice to anyone.",
    icon: Lock,
    title: "Secret ballots with proof",
  },
  {
    body: "Watch turnout and tallies update the moment votes land. You decide who sees results - live for everyone, on close, or only when officially published.",
    icon: BarChart3,
    title: "Results as they happen",
  },
  {
    body: "Sensitive changes go through approval before they take effect, and every action - including the administrators' - lands in a tamper-evident audit trail.",
    icon: ShieldCheck,
    title: "Four-eyes governance",
  },
  {
    body: "Presidents, secretaries, referenda; campus-wide races or seats scoped to a faculty, hall, or branch. If your constitution allows it, you can run it.",
    icon: UsersRound,
    title: "Any election, any structure",
  },
  {
    body: "Voters sign in with a one-time code to their phone or email - no passwords to forget on election day. Staff accounts are protected with two-factor authentication.",
    icon: Fingerprint,
    title: "Sign-in that just works",
  },
  {
    body: "Close the election, certify the outcome into a sealed official record, and export results ready to publish. The numbers can't quietly change afterwards.",
    icon: FileCheck2,
    title: "Certified, final outcomes",
  },
];

export function Features() {
  return (
    <section className="mx-auto w-full max-w-6xl scroll-mt-20 px-4 py-20 sm:px-6" id="product">
      <div className="max-w-2xl">
        <p className="text-sm font-medium text-brand">Why Elektor Pro</p>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
          Everything an election needs. Nothing to dispute.
        </h2>
        <p className="mt-3 leading-relaxed text-muted-foreground">
          One platform carries your election end to end - so committees stop
          juggling spreadsheets, paper ballots, and arguments about the count.
        </p>
      </div>
      <div className="mt-10 grid gap-px overflow-hidden rounded-2xl border border-border bg-border sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map((feature) => (
          <div className="bg-card p-6" key={feature.title}>
            <span className="inline-flex size-9 items-center justify-center rounded-lg bg-brand-muted text-brand">
              <feature.icon className="size-4" />
            </span>
            <h3 className="mt-4 font-medium">{feature.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{feature.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
