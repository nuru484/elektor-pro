import { ArrowRight } from "lucide-react";
import Link from "next/link";

import { HeroVisual } from "./hero-visual";

// Visual-first hero: the animated live election board carries the message on
// its own - no headline or description copy. An sr-only h1 keeps the page
// accessible and indexable; the pill CTAs and the hairline claims row sit
// beneath the board.
export function Hero() {
  return (
    <section className="mx-auto mb-24 max-w-6xl pt-8 md:mb-32 md:pt-14">
      <div className="px-6 md:px-10">
        <h1 className="sr-only">
          Elektor Pro - run elections everyone trusts, from nominations to
          certified results.
        </h1>

        <HeroVisual />

        <div className="mt-10 flex flex-wrap items-center gap-3">
          <Link href="/login">
            <button
              className="flex items-center justify-center gap-2 whitespace-nowrap rounded-full border border-foreground bg-foreground px-6 py-3 text-base font-medium text-background transition-colors duration-500 ease-in-out hover:bg-transparent hover:text-foreground md:px-8 md:py-3.5 md:text-lg"
              type="button"
            >
              Start an election <ArrowRight className="size-5" />
            </button>
          </Link>
          <Link href="/vote">
            <button
              className="flex items-center justify-center gap-2 whitespace-nowrap rounded-full border border-foreground bg-transparent px-6 py-3 text-base font-medium text-foreground transition-colors duration-500 ease-in-out hover:bg-foreground hover:text-background md:px-8 md:py-3.5 md:text-lg"
              type="button"
            >
              Cast your vote
            </button>
          </Link>
        </div>

        {/* Hairline claims row - plain type, no badges, no icons. */}
        <dl className="mt-16 grid max-w-3xl grid-cols-1 divide-y divide-border border-y border-border sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          {[
            ["Secret ballots", "never linked to the voter"],
            ["Live results", "as every vote lands"],
            ["Verifiable outcomes", "receipts prove the count"],
          ].map(([claim, detail], index) => (
            <div
              className={
                index === 0 ? "py-5 sm:pr-8" : index === 1 ? "py-5 sm:px-8" : "py-5 sm:pl-8"
              }
              key={claim}
            >
              <dt className="text-lg font-medium">{claim}</dt>
              <dd className="mt-0.5 text-muted-foreground">{detail}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
