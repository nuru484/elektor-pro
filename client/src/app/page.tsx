import {
  ArrowRight,
  BarChart3,
  CheckCircle2,
  FileCheck2,
  Fingerprint,
  Layers,
  ListChecks,
  Lock,
  ShieldCheck,
} from "lucide-react";

import { Logo } from "@/components/brand/logo";
import { LinkButton } from "@/components/ui/link-button";

const features = [
  {
    description:
      "Ballots are decoupled from voter identity. Every voter gets a receipt code to verify their vote counted — without revealing their choice.",
    icon: Lock,
    title: "Secret ballot, verifiable",
  },
  {
    description:
      "Live tallies stream to the results room over websockets. Configure who sees what, and when, per election.",
    icon: BarChart3,
    title: "Real-time results",
  },
  {
    description:
      "Staff changes are staged for super-admin approval. Every action is written to a tamper-evident, hash-chained audit log.",
    icon: ShieldCheck,
    title: "Maker-checker governance",
  },
  {
    description:
      "Single-choice, multi-select, or yes/no referenda. Scope positions to faculties, halls, or branches — or let everyone vote everything.",
    icon: ListChecks,
    title: "Any election shape",
  },
  {
    description:
      "Voters log in with a one-time code by SMS. Staff use email, password, and TOTP two-factor with account lockout.",
    icon: Fingerprint,
    title: "Layered authentication",
  },
  {
    description:
      "Certify final results into an immutable, hashed snapshot and export official reports as CSV or PDF.",
    icon: FileCheck2,
    title: "Certified outcomes",
  },
];

const steps = [
  { body: "Set up portfolios, candidates, and your voter roll. Scope positions to any constituency.", title: "Configure" },
  { body: "Voters authenticate, see only the ballot they're eligible for, and cast a secret vote.", title: "Vote" },
  { body: "Watch turnout and tallies live, then certify and publish verifiable official results.", title: "Decide" },
];

export default function Home() {
  return (
    <div className="flex min-h-dvh flex-col">
      {/* Nav */}
      <header className="sticky top-0 z-40 border-b border-border/70 bg-background/80 backdrop-blur-md">
        <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Logo />
          <div className="hidden items-center gap-8 text-sm text-muted-foreground md:flex">
            <a className="transition-colors hover:text-foreground" href="#features">Features</a>
            <a className="transition-colors hover:text-foreground" href="#how">How it works</a>
            <a className="transition-colors hover:text-foreground" href="#roles">Roles</a>
          </div>
          <div className="flex items-center gap-2">
            <LinkButton className="hidden sm:inline-flex" href="/vote" size="sm" variant="ghost">
              I&apos;m a voter
            </LinkButton>
            <LinkButton href="/login" size="sm" variant="default">
              Sign in
            </LinkButton>
          </div>
        </nav>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden border-b border-border">
        <div className="pointer-events-none absolute inset-0 bg-grid opacity-60" />
        <div className="relative mx-auto max-w-6xl px-4 py-20 text-center sm:px-6 sm:py-28">
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
            <span className="size-1.5 rounded-full bg-success" />
            Secret ballot · Verifiable · Auditable
          </span>
          <h1 className="mx-auto mt-6 max-w-3xl text-4xl font-semibold leading-[1.1] sm:text-6xl">
            Elections your organization can{" "}
            <span className="text-brand">actually trust</span>.
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-base text-muted-foreground sm:text-lg">
            Elektor Pro runs secure, customizable elections for student bodies,
            unions, companies, and associations — with secret ballots, live
            results, and a tamper-evident audit trail end to end.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <LinkButton className="w-full sm:w-auto" href="/vote" size="lg" variant="brand">
              Cast your vote <ArrowRight className="size-4" />
            </LinkButton>
            <LinkButton className="w-full sm:w-auto" href="/login" size="lg" variant="outline">
              Administrator sign in
            </LinkButton>
          </div>
          <dl className="mx-auto mt-14 grid max-w-2xl grid-cols-3 gap-4 border-t border-border pt-8 text-center">
            {[
              ["100%", "Secret ballots"],
              ["Live", "Real-time tallies"],
              ["Hash-chained", "Audit trail"],
            ].map(([stat, label]) => (
              <div key={label}>
                <dt className="text-2xl font-semibold sm:text-3xl">{stat}</dt>
                <dd className="mt-1 text-xs text-muted-foreground sm:text-sm">{label}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6" id="features">
        <div className="max-w-2xl">
          <h2 className="text-2xl font-semibold sm:text-3xl">
            Built for real-world integrity
          </h2>
          <p className="mt-3 text-muted-foreground">
            Every feature is designed around trust, transparency, and the messy
            realities of running an election.
          </p>
        </div>
        <div className="mt-10 grid gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <div className="bg-card p-6" key={f.title}>
              <f.icon className="size-5 text-brand" />
              <h3 className="mt-4 font-medium">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {f.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="border-y border-border bg-muted/30" id="how">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <h2 className="text-2xl font-semibold sm:text-3xl">Three steps to a decision</h2>
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {steps.map((s, i) => (
              <div className="relative rounded-xl border border-border bg-card p-6" key={s.title}>
                <span className="flex size-8 items-center justify-center rounded-full bg-brand text-sm font-semibold text-brand-foreground">
                  {i + 1}
                </span>
                <h3 className="mt-4 font-medium">{s.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Roles */}
      <section className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6" id="roles">
        <div className="grid gap-10 md:grid-cols-2 md:items-center">
          <div>
            <h2 className="text-2xl font-semibold sm:text-3xl">
              The right access for every role
            </h2>
            <p className="mt-3 text-muted-foreground">
              From super-admins who certify results to agents who observe the
              results room and voters who simply cast a ballot — everyone gets
              exactly the access they need, and nothing more.
            </p>
            <LinkButton className="mt-6" href="/login" variant="brand">
              Get started <ArrowRight className="size-4" />
            </LinkButton>
          </div>
          <ul className="grid gap-3">
            {[
              ["Super admin", "Approves changes, certifies results, full oversight."],
              ["Admin", "Runs the election — proposals reviewed before they apply."],
              ["Agent", "Observes the live results room for their candidates."],
              ["Candidate", "Sees their standing once results are released."],
              ["Voter", "Logs in by SMS code and casts a private, verifiable vote."],
            ].map(([role, desc]) => (
              <li className="flex items-start gap-3 rounded-lg border border-border bg-card p-4" key={role}>
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-brand" />
                <span className="text-sm">
                  <span className="font-medium">{role}.</span>{" "}
                  <span className="text-muted-foreground">{desc}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-border">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <div className="flex flex-col items-center gap-6 rounded-2xl border border-border bg-card px-6 py-14 text-center">
            <Layers className="size-6 text-brand" />
            <h2 className="max-w-lg text-2xl font-semibold sm:text-3xl">
              Ready to run an election worth trusting?
            </h2>
            <div className="flex flex-col gap-3 sm:flex-row">
              <LinkButton href="/vote" size="lg" variant="brand">
                Cast your vote
              </LinkButton>
              <LinkButton href="/login" size="lg" variant="outline">
                Administrator sign in
              </LinkButton>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-auto border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 py-8 sm:flex-row sm:px-6">
          <Logo />
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} Elektor Pro. Built for transparent elections.
          </p>
        </div>
      </footer>
    </div>
  );
}
