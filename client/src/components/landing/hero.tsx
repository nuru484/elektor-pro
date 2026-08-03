import { ArrowRight } from "lucide-react";
import Link from "next/link";

// Elektor Pro's own hero in the shared design language: centered-left column,
// a two-tone fluid headline (the second thought in muted ink), lead paragraph,
// inversion pill CTAs, and a hairline claims row instead of badges or cards.
export function Hero() {
  return (
    <section className="mx-auto mb-24 max-w-6xl pt-10 md:mb-32 md:pt-20">
      <div className="px-6 md:px-10">
        <p className="text-lg text-muted-foreground">
          The e-voting platform for organizations
        </p>

        {/* Fluid size so long words fit a 280px viewport without breaks. */}
        <h1 className="mt-6 max-w-4xl text-[clamp(2.1rem,11vw,3rem)] font-medium leading-[1.08] tracking-normal md:text-6xl lg:text-7xl">
          Elections everyone trusts.{" "}
          <span className="text-muted-foreground/60">
            From nominations to certified results.
          </span>
        </h1>

        <p className="mt-7 max-w-2xl text-lg leading-relaxed text-muted-foreground">
          Secret ballots, live tallies, and proof behind every vote - for
          universities, unions, associations, and companies that cannot afford
          a disputed outcome.
        </p>

        <div className="mt-9 flex flex-wrap items-center gap-3">
          <Link href="/login">
            <button
              className="flex items-center justify-center gap-2 whitespace-nowrap rounded-full border border-foreground bg-foreground px-6 py-3 text-base font-medium text-background transition-colors duration-500 ease-in-out hover:bg-transparent hover:text-foreground md:px-8 md:py-4 md:text-lg"
              type="button"
            >
              Start an election <ArrowRight className="size-5" />
            </button>
          </Link>
          <Link href="/vote">
            <button
              className="flex items-center justify-center gap-2 whitespace-nowrap rounded-full border border-foreground bg-transparent px-6 py-3 text-base font-medium text-foreground transition-colors duration-500 ease-in-out hover:bg-foreground hover:text-background md:px-8 md:py-4 md:text-lg"
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
              className={index === 0 ? "py-5 sm:pr-8" : index === 1 ? "py-5 sm:px-8" : "py-5 sm:pl-8"}
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
