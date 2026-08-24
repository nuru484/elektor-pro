// The product section runs two layouts back to back: a two-up block of the
// guarantees the whole platform rests on, then the capability grid as tall
// alternating panels - bordered, ink and blue in a checker so no row repeats
// the row above it.
import { ArrowRight } from "lucide-react";
import Link from "next/link";

import { cssVars } from "@/utils/css-vars";

const PILLARS = [
  {
    body: "A ballot is separated from the voter the moment it is cast. Nobody - including the administrators running the election - can trace one back to a person.",
    href: "/#security",
    linkLabel: "How the ballot chain works",
    title: "Secret by construction",
  },
  {
    body: "The count is produced once at close, certified into a sealed record, and published as a signed declaration. The numbers cannot quietly change afterwards.",
    href: "/#how-it-works",
    linkLabel: "See the election lifecycle",
    title: "Sealed at close",
  },
] as const;

/** Panel fills, in the order the capability cards consume them. Six cards
 *  over a three-column grid, so the sequence has to be six long to land a
 *  different fill under each one on the second row. */
const FILLS = [
  "border border-border bg-card text-card-foreground",
  "bg-ink text-ink-foreground",
  "bg-brand text-brand-foreground",
  "bg-ink text-ink-foreground",
  "bg-brand text-brand-foreground",
  "border border-border bg-card text-card-foreground",
] as const;

const CAPABILITIES = [
  {
    body: "Every voter walks away with a private receipt code that proves their ballot was counted, without revealing their choice to anyone.",
    title: "Secret ballots with proof",
  },
  {
    body: "Watch turnout and tallies update the moment votes land. You decide who sees results - live, on close, or only once officially published.",
    title: "Results as they happen",
  },
  {
    body: "Sensitive changes go through a second approval before they take effect, and every action lands in a tamper-evident audit trail.",
    title: "Four-eyes governance",
  },
  {
    body: "Presidents, secretaries, referenda; campus-wide races or seats scoped to a faculty, hall or branch. If your constitution allows it, you can run it.",
    title: "Any election, any structure",
  },
  {
    body: "Voters sign in with a one-time code to their phone or email - no passwords to forget on election day. Staff accounts carry two-factor authentication.",
    title: "Sign-in that just works",
  },
  {
    body: "Close the election, certify the outcome into a sealed official record, and export results ready to publish.",
    title: "Certified, final outcomes",
  },
] as const;

export function Features() {
  return (
    <section className="scroll-mt-24 py-20 md:py-28" id="product">
      <div className="mx-auto w-full max-w-[100rem] px-5 md:px-8 lg:px-12">
        <p data-reveal className="font-mono text-[11px] font-medium tracking-[0.2em] uppercase text-brand">
          The product
        </p>
        <h2
          data-reveal
          className="display mt-5 max-w-[16ch] text-[clamp(2rem,5vw,4.5rem)]"
        >
          Everything an election needs
        </h2>
        <p
          data-reveal
          className="mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground"
        >
          One platform carries your election end to end - no spreadsheets, no
          paper trails, no arguments about the count.
        </p>

        {/* Two-up guarantees. The blue panel leads and takes the wider cell. */}
        <div className="mt-14 grid gap-4 lg:grid-cols-[1.35fr_1fr] md:mt-18">
          {PILLARS.map((pillar, index) => (
            <div
              // The two cells travel at different rates across the same
              // scroll range, which is what reads as depth between them.
              data-drift
              style={cssVars(
                index === 0
                  ? { "--drift-from": "1.5rem", "--drift-to": "-1.5rem" }
                  : { "--drift-from": "3rem", "--drift-to": "-3rem" },
              )}
              className={`flex min-h-[26rem] flex-col justify-between p-8 md:p-12 ${
                index === 0
                  ? "bg-brand-pale text-brand-pale-foreground"
                  : "bg-ink text-ink-foreground"
              }`}
              key={pillar.title}
            >
              <div>
                <h3 className="display max-w-[12ch] text-[clamp(1.75rem,3.6vw,3.25rem)]">
                  {pillar.title}
                </h3>
                <p
                  className={`mt-7 max-w-[42ch] text-lg leading-relaxed ${
                    index === 0 ? "text-foreground/75" : "text-ink-foreground/75"
                  }`}
                >
                  {pillar.body}
                </p>
              </div>
              <Link
                aria-label={pillar.linkLabel}
                className={`mt-12 grid size-14 place-items-center border-[1.6px] transition-colors ${
                  index === 0
                    ? "border-foreground text-foreground hover:bg-foreground hover:text-background"
                    : "border-ink-foreground text-ink-foreground hover:bg-ink-foreground hover:text-ink"
                }`}
                href={pillar.href}
              >
                <ArrowRight aria-hidden className="size-6" />
              </Link>
            </div>
          ))}
        </div>

        {/* Capability panels. */}
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {CAPABILITIES.map((capability, index) => (
            <article
              data-reveal-item
              style={cssVars({ "--i": index })}
              className={`flex min-h-[22rem] flex-col justify-between p-8 ${FILLS[index]}`}
              key={capability.title}
            >
              <p className="font-mono text-sm font-medium tracking-[0.18em] opacity-60">
                {(index + 1).toString().padStart(2, "0")}
              </p>
              <div className="mt-16">
                <h3 className="font-display text-2xl font-semibold leading-snug">
                  {capability.title}
                </h3>
                <p className="mt-3 leading-relaxed opacity-80">
                  {capability.body}
                </p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
