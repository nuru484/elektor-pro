"use client";

// Declaration-style hero: editorial message column (mono eyebrow, serif
// display headline, lede, pill CTAs, mono assurance line) beside the
// certified-declaration panel. Elements rise in numbered steps on load and
// the seal stamps in once the counts settle; reduced motion renders the
// final state instantly (rules in globals.css).
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { DeclarationPanel } from "./declaration-panel";

const SEAL_DELAY_MS = 1200;

const PROOF_BAND: [string, string, string][] = [
  [
    "Ballot",
    "Secret by construction",
    "A ballot is separated from the voter at the moment it is cast. Nobody, including you, can trace one back.",
  ],
  [
    "Count",
    "Sealed at close",
    "No running tally while voting is open. The count is produced once, certified, and published as a signed declaration.",
  ],
  [
    "Proof",
    "Checked by anyone",
    "Every voter leaves with a receipt code. Anyone can confirm that a ballot entered the count without revealing how it was cast.",
  ],
];

export function Hero() {
  const [ready, setReady] = useState(false);
  const [sealed, setSealed] = useState(false);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      setReady(true);
    });
    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const timer = setTimeout(() => {
      setSealed(true);
    }, reduced ? 0 : SEAL_DELAY_MS);
    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(timer);
    };
  }, []);

  return (
    <section
      className={`mb-24 md:mb-32 ${ready ? "hero-ready" : ""} ${sealed ? "hero-sealed" : ""}`}
    >
      <div className="mx-auto max-w-6xl px-6 pt-10 pb-20 md:px-10 md:pt-16 md:pb-24">
        <div className="grid items-start gap-12 lg:grid-cols-[1.02fr_0.98fr] lg:gap-16">
          {/* Message column */}
          <div>
            <h1
              className="rise text-[clamp(2.6rem,5.6vw,4.2rem)] font-semibold leading-[1.08]"
              data-step="1"
            >
              Run the <span className="text-muted-foreground/70">vote.</span>
              <br />
              Publish the <span className="text-brand">proof</span>
            </h1>

            <p
              className="rise mt-8 max-w-[34ch] text-lg leading-relaxed text-muted-foreground md:mt-10"
              data-step="3"
            >
              Elektor Pro runs elections for unions, universities, associations
              and party primaries. Voters keep a receipt they can check
              themselves, so the result is something you can show, not something
              people have to take on faith.
            </p>

            <div
              className="rise mt-10 flex flex-wrap items-center gap-3 md:mt-12"
              data-step="4"
            >
              <Link className="max-sm:w-full" href="/login">
                <button
                  className="flex items-center justify-center gap-2 whitespace-nowrap rounded-full border border-foreground bg-foreground px-6 py-3 text-base font-medium text-background transition-colors duration-500 ease-in-out hover:bg-transparent hover:text-foreground max-sm:w-full md:px-8 md:py-3.5 md:text-lg"
                  type="button"
                >
                  Start an election <ArrowRight className="size-5" />
                </button>
              </Link>
              <Link className="max-sm:w-full" href="/vote">
                <button
                  className="flex items-center justify-center gap-2 whitespace-nowrap rounded-full border border-foreground bg-transparent px-6 py-3 text-base font-medium text-foreground transition-colors duration-500 ease-in-out hover:bg-foreground hover:text-background max-sm:w-full md:px-8 md:py-3.5 md:text-lg"
                  type="button"
                >
                  Cast your vote
                </button>
              </Link>
              {/* Demo visitors: sign in as any role, no credentials. */}
              <Link
                className="text-base font-medium text-brand underline-offset-4 hover:underline max-sm:w-full max-sm:text-center md:text-lg"
                href="/demo"
              >
                Explore a live demo
              </Link>
            </div>
          </div>

          {/* Declaration panel */}
          <div className="rise" data-step="3">
            <DeclarationPanel />
          </div>
        </div>
      </div>

      {/* Proof band - how results hold up. */}
      <div aria-label="How results hold up" className="border-y border-border bg-card/40" role="region">
        <div className="mx-auto grid max-w-6xl grid-cols-1 gap-6 px-6 py-10 md:px-10 lg:grid-cols-3">
          {PROOF_BAND.map(([label, title, body], index) => (
            <div
              className={
                index === 0
                  ? ""
                  : "border-t border-border pt-6 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-6"
              }
              key={label}
            >
              <p className="font-mono text-[11px] font-bold tracking-[0.16em] uppercase text-brand">
                {label}
              </p>
              <h3 className="mt-2 font-display text-xl font-semibold">
                {title}
              </h3>
              <p className="mt-1.5 max-w-[30ch] text-sm text-muted-foreground">
                {body}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
