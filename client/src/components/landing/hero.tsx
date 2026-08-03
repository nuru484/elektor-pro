import { ArrowRight } from "lucide-react";
import Link from "next/link";

// Typography-led hero in the portfolio's language: a giant fluid headline,
// muted lead on the right, inversion pill CTAs on the left. No badges, no
// icon chips, no mock cards.
export function Hero() {
  return (
    <section className="mx-auto mb-24 max-w-6xl pt-6 md:mb-32 md:pt-12">
      <div className="px-6 md:px-12">
        <p className="text-lg text-muted-foreground">
          Secure e-voting for organizations
        </p>

        {/* Fluid size so the longest word fits a 280px viewport without
            mid-word breaks. */}
        <h1 className="mt-8 mb-5 text-[clamp(2.1rem,12vw,3rem)] font-medium leading-tight tracking-normal md:mb-8 md:text-6xl lg:text-[5.5rem]">
          Run elections everyone trusts, start to finish.
        </h1>

        <div className="flex flex-wrap justify-between gap-6 md:flex-nowrap">
          <div className="w-full sm:order-2 md:w-1/2">
            <p className="text-left text-lg leading-relaxed tracking-normal text-muted-foreground">
              Elektor Pro carries your election from nominations to certified
              results - secret ballots, live tallies, and proof behind every
              vote. Built for universities, unions, associations, and
              companies that cannot afford a disputed outcome.
            </p>
          </div>
          {/* Compact on phones so both buttons share one row (wraps only
              when space truly runs out, e.g. 280px folds). */}
          <div className="flex w-full flex-wrap items-center gap-3 sm:order-1 md:w-1/2">
            <Link href="/login">
              <button
                className="flex items-center justify-center gap-2 whitespace-nowrap rounded-full border border-foreground bg-foreground px-5 py-3 text-base font-medium text-background transition-colors duration-500 ease-in-out hover:bg-transparent hover:text-foreground md:px-8 md:py-4 md:text-xl"
                type="button"
              >
                Start an election <ArrowRight className="size-5" />
              </button>
            </Link>
            <Link href="/vote">
              <button
                className="flex items-center justify-center gap-2 whitespace-nowrap rounded-full border border-foreground bg-transparent px-5 py-3 text-base font-medium text-foreground transition-colors duration-500 ease-in-out hover:bg-foreground hover:text-background md:px-8 md:py-4 md:text-xl"
                type="button"
              >
                Cast your vote
              </button>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
