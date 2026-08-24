// The audiences as a single row of outline-only cards, each anchored by a
// square arrow that fills on hover - deliberately the lightest section on the
// page, sitting between the graphite security block and the FAQ.
import { ArrowRight } from "lucide-react";
import Link from "next/link";

import { cssVars } from "@/utils/css-vars";

const USE_CASES = [
  {
    body: "SRC and departmental elections, hall week polls, class rep votes - run them all every year on one platform, with the full history kept.",
    title: "Universities and schools",
  },
  {
    body: "National, regional, and branch executive elections with constituency-scoped ballots and agents observing the count for every candidate.",
    title: "Unions and federations",
  },
  {
    body: "Annual general meetings, board seats, and constitutional referenda - with quorum-ready turnout numbers and certified outcomes.",
    title: "Associations and clubs",
  },
  {
    body: "Staff councils, committee seats, and workplace polls that need anonymity guarantees employees actually believe.",
    title: "Companies and co-ops",
  },
];

export function UseCases() {
  return (
    <section className="py-20 md:py-28">
      <div className="mx-auto w-full max-w-[100rem] px-5 md:px-8 lg:px-12">
        <h2
          data-reveal
          className="display max-w-[18ch] text-[clamp(2rem,5vw,4.5rem)]"
        >
          Built for every kind of body
        </h2>
        <p className="mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground">
          Set it up once and reuse it election after election, year after year -
          your members keep one login and the full history stays at their
          fingertips.
        </p>

        <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-4 md:mt-18">
          {USE_CASES.map((useCase, index) => (
            <article
              data-reveal-item
              style={cssVars({ "--i": index })}
              className="group flex min-h-[20rem] flex-col justify-between border border-foreground/70 p-7 transition-colors hover:border-brand"
              key={useCase.title}
            >
              <div>
                <h3 className="font-display text-2xl font-medium leading-snug transition-colors group-hover:text-brand">
                  {useCase.title}
                </h3>
                <p className="mt-4 leading-relaxed text-muted-foreground">
                  {useCase.body}
                </p>
              </div>
              <span
                aria-hidden
                className="mt-8 grid size-12 flex-none place-items-center border-[1.6px] border-foreground text-foreground transition-colors group-hover:border-brand group-hover:bg-brand group-hover:text-brand-foreground"
              >
                <ArrowRight aria-hidden className="size-5" />
              </span>
            </article>
          ))}
        </div>

        <Link
          className="mt-10 inline-flex items-center gap-2 border-[1.6px] border-foreground bg-foreground px-8 py-3.5 text-lg font-semibold text-background transition-colors duration-200 hover:bg-transparent hover:text-foreground"
          href="/demo"
        >
          Explore a live demo
        </Link>
      </div>
    </section>
  );
}
