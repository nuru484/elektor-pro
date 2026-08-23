"use client";

// The hero is one full-bleed blue block with square corners: message column
// on the left, the certified-declaration panel floating on the wash to the
// right, and three outlined assurance cards running along the bottom edge.
// Elements rise in numbered steps on load and the seal stamps in once the
// counts settle; reduced motion renders the final state instantly (rules in
// globals.css).
import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { DeclarationPanel } from "./declaration-panel";

const SEAL_DELAY_MS = 1200;

const ASSURANCES: [string, string][] = [
  ["Secret ballot", "Separated from the voter as it is cast"],
  ["Live count", "Turnout and tallies as the votes land"],
  ["Public proof", "A receipt code anyone can check"],
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
    const timer = setTimeout(
      () => {
        setSealed(true);
      },
      reduced ? 0 : SEAL_DELAY_MS,
    );
    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(timer);
    };
  }, []);

  return (
    <section
      className={`${ready ? "hero-ready" : ""} ${sealed ? "hero-sealed" : ""}`}
    >
      <div className="mx-auto w-full max-w-[100rem] px-5 md:px-8 lg:px-12">
        {/* The wash runs light in the upper right and deepens to the left.
            Its lightest stop is capped at the point where solid white still
            clears 4.5:1, which is also why nothing here uses translucent
            white: hierarchy comes from size and weight instead, and those
            cost no contrast. */}
        <div className="relative overflow-hidden bg-[radial-gradient(115%_115%_at_82%_10%,oklch(0.56_0.155_243)_0%,oklch(0.51_0.185_250)_46%,oklch(0.46_0.2_257)_100%)] px-6 py-14 text-white md:px-12 md:py-18 lg:px-16 lg:py-20">
          <div className="grid items-center gap-12 lg:grid-cols-[1.02fr_0.98fr] lg:gap-16">
            {/* Message column */}
            <div>
              <p
                className="rise font-mono text-[11px] font-medium tracking-[0.2em] text-white uppercase"
                data-step="1"
              >
                Elections, end to end
              </p>

              {/* Each line is a real text node inside its own clipping box,
                  so the heading is still one string to a screen reader while
                  the lines swing up from behind their own edge. */}
              <h1 className="display mt-6 text-[clamp(2.9rem,6.4vw,5.6rem)]">
                <span className="line-mask">
                  <span>Run the vote.</span>
                </span>
                <span className="line-mask">
                  <span>Publish the proof.</span>
                </span>
              </h1>

              <p
                className="rise mt-7 max-w-[36ch] text-lg leading-relaxed text-white"
                data-step="3"
              >
                Voters keep a receipt they can check themselves, so the result
                is something you show rather than something people take on
                faith.
              </p>

              <div
                className="rise mt-9 flex flex-wrap items-center gap-3"
                data-step="4"
              >
                <Link
                  className="flex items-center justify-center gap-2 border-[1.6px] border-white bg-white px-8 py-3.5 text-base font-semibold whitespace-nowrap text-brand transition-colors duration-200 hover:bg-transparent hover:text-white max-sm:w-full md:text-lg"
                  href="/login"
                >
                  Start an election <ArrowUpRight aria-hidden className="size-5" />
                </Link>
                <Link
                  className="flex items-center justify-center gap-2 border-[1.6px] border-white px-8 py-3.5 text-base font-semibold whitespace-nowrap text-white transition-colors duration-200 hover:bg-white hover:text-brand max-sm:w-full md:text-lg"
                  href="/vote"
                >
                  Cast your vote
                </Link>
              </div>
            </div>

            {/* Declaration panel - the product visual, floating on the wash. */}
            <div className="rise" data-step="3">
              <DeclarationPanel />
            </div>
          </div>

          {/* Assurance cards along the bottom edge of the block. */}
          <div
            className="rise mt-14 grid gap-4 sm:grid-cols-3 md:mt-18"
            data-step="4"
          >
            {ASSURANCES.map(([title, body]) => (
              <div
                className="border border-white/55 px-5 py-5 transition-colors hover:border-white"
                key={title}
              >
                <p className="font-display text-lg font-semibold">{title}</p>
                <p className="mt-1 text-sm leading-relaxed text-white">
                  {body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
