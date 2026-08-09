// Feature grid as clean bordered cards - Elektor's own take on the shared
// language (hairlines, muted type, quiet numbering), distinct from the
// portfolio's outlined-number signature. Each card carries a small product
// vignette (a mock slice of the real UI, same family as the hero's
// declaration panel), a mono index, a brand top rule that brightens on
// hover, title, and body.
import type { ReactNode } from "react";

interface Feature {
  body: string;
  number: number;
  title: string;
  vignette: ReactNode;
}

/* --- Vignettes -----------------------------------------------------------
   Decorative mock-UI slices with sample data; every fact they show is
   restated in the card copy, so they are aria-hidden. Shared container
   look: quiet inset panel, mono type, brand used once per vignette. */

function VignetteFrame({ children }: { children: ReactNode }) {
  return (
    <div
      aria-hidden
      className="flex h-28 flex-col justify-center gap-2 rounded-xl border border-border/70 bg-background/70 px-4 py-3"
    >
      {children}
    </div>
  );
}

function ReceiptVignette() {
  return (
    <VignetteFrame>
      <p className="font-mono text-[10px] tracking-[0.14em] uppercase text-muted-foreground">
        Ballot receipt
      </p>
      <p className="font-mono text-sm font-bold tracking-[0.06em]">
        7Q4K-&bull;&bull;&bull;&bull;-2R8T
      </p>
      <p className="font-mono text-[11px] text-muted-foreground">
        <span className="text-brand">&#10003; In the count</span> &middot;
        identity not attached
      </p>
    </VignetteFrame>
  );
}

function LiveTallyVignette() {
  return (
    <VignetteFrame>
      <div className="flex items-center justify-between">
        <p className="font-mono text-[10px] tracking-[0.14em] uppercase text-muted-foreground">
          Turnout 61.4%
        </p>
        <p className="flex items-center gap-1.5 font-mono text-[10px] tracking-[0.14em] uppercase text-brand">
          <span className="relative flex size-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand opacity-60" />
            <span className="relative inline-flex size-1.5 rounded-full bg-brand" />
          </span>
          Live
        </p>
      </div>
      {[
        { pct: 58, lead: true },
        { pct: 31, lead: false },
        { pct: 11, lead: false },
      ].map(({ pct, lead }) => (
        <div className="h-1.5 overflow-hidden rounded-full bg-muted" key={pct}>
          <div
            className={`h-full rounded-full ${lead ? "bg-brand" : "bg-muted-foreground/40"}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      ))}
    </VignetteFrame>
  );
}

function ApprovalVignette() {
  return (
    <VignetteFrame>
      <p className="font-mono text-[10px] tracking-[0.14em] uppercase text-muted-foreground">
        Change request &middot; Reopen polls
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full border border-brand/50 bg-brand-muted px-2.5 py-1 font-mono text-[11px] text-foreground">
          A.K. &#10003; Approved
        </span>
        <span className="rounded-full border border-border px-2.5 py-1 font-mono text-[11px] text-muted-foreground">
          T.M. &middot; Pending
        </span>
      </div>
      <p className="font-mono text-[11px] text-muted-foreground">
        Takes effect after second approval
      </p>
    </VignetteFrame>
  );
}

function StructureVignette() {
  return (
    <VignetteFrame>
      {[
        ["President", "Campus-wide"],
        ["Secretary", "Science Faculty"],
        ["Referendum", "All members"],
      ].map(([office, scope]) => (
        <p
          className="flex items-baseline justify-between gap-3 font-mono text-[11px]"
          key={office}
        >
          <span className="font-bold text-foreground">{office}</span>
          <span className="text-muted-foreground">{scope}</span>
        </p>
      ))}
    </VignetteFrame>
  );
}

function OtpVignette() {
  return (
    <VignetteFrame>
      <p className="font-mono text-[10px] tracking-[0.14em] uppercase text-muted-foreground">
        One-time code &middot; sent to &bull;&bull;&bull;@&hellip;
      </p>
      <div className="flex gap-1.5">
        {["4", "8", "2", "9", "", ""].map((digit, index) => (
          <span
            className={`flex h-9 w-7 items-center justify-center rounded-md border font-mono text-sm font-bold ${
              digit
                ? "border-border bg-card text-foreground"
                : index === 4
                  ? "border-brand text-brand"
                  : "border-border/60 text-muted-foreground"
            }`}
            key={index}
          >
            {digit || " "}
          </span>
        ))}
      </div>
    </VignetteFrame>
  );
}

function CertifiedVignette() {
  return (
    <VignetteFrame>
      <div className="flex items-center gap-3">
        <span className="flex-none -rotate-6 rounded-md border-2 border-brand px-2 py-1 font-mono text-[11px] font-bold tracking-[0.16em] uppercase text-brand">
          Certified
        </span>
        <div className="min-w-0 font-mono text-[11px] leading-relaxed text-muted-foreground">
          <p className="truncate">Sealed 12 Jun 2026 &middot; 18:04</p>
          <p className="truncate">Record 88C1 &middot; final</p>
        </div>
      </div>
    </VignetteFrame>
  );
}

const FEATURES: Feature[] = [
  {
    body: "Ballots are never linked to the voter. Each voter walks away with a private receipt code that proves their vote was counted, without revealing their choice to anyone.",
    number: 1,
    title: "Secret ballots with proof",
    vignette: <ReceiptVignette />,
  },
  {
    body: "Watch turnout and tallies update the moment votes land. You decide who sees results - live for everyone, on close, or only when officially published.",
    number: 2,
    title: "Results as they happen",
    vignette: <LiveTallyVignette />,
  },
  {
    body: "Sensitive changes go through approval before they take effect, and every action - including the administrators' own - lands in a tamper-evident audit trail.",
    number: 3,
    title: "Four-eyes governance",
    vignette: <ApprovalVignette />,
  },
  {
    body: "Presidents, secretaries, referenda; campus-wide races or seats scoped to a faculty, hall, or branch. If your constitution allows it, you can run it.",
    number: 4,
    title: "Any election, any structure",
    vignette: <StructureVignette />,
  },
  {
    body: "Voters sign in with a one-time code to their phone or email - no passwords to forget on election day. Staff accounts carry two-factor authentication.",
    number: 5,
    title: "Sign-in that just works",
    vignette: <OtpVignette />,
  },
  {
    body: "Close the election, certify the outcome into a sealed official record, and export results ready to publish. The numbers cannot quietly change afterwards.",
    number: 6,
    title: "Certified, final outcomes",
    vignette: <CertifiedVignette />,
  },
];

function FeatureCard({ body, number, title, vignette }: Feature) {
  return (
    <div className="group relative flex flex-col gap-3 overflow-hidden rounded-2xl border border-border bg-card/60 p-7 transition-colors hover:border-brand/50 lg:w-96 lg:flex-none lg:snap-start">
      {/* Brand top rule that brightens on hover. */}
      <span
        aria-hidden
        className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-brand/60 to-transparent opacity-40 transition-opacity group-hover:opacity-100"
      />
      {vignette}
      <span className="mt-1 font-mono text-xs tracking-[0.18em] text-muted-foreground/70">
        {number.toString().padStart(2, "0")}
      </span>
      <h3 className="text-xl font-medium leading-snug md:text-2xl">{title}</h3>
      <p className="leading-relaxed text-muted-foreground">{body}</p>
    </div>
  );
}

export function Features() {
  return (
    <section className="mb-24 scroll-mt-8 md:mb-32" id="product">
      <div className="mx-auto max-w-6xl px-6 md:px-10">
        <div className="max-w-2xl">
          <h2 className="text-4xl font-medium md:text-5xl">
            Everything an election needs
          </h2>
          <p className="mt-4 text-lg leading-relaxed text-muted-foreground">
            One platform carries your election end to end - no spreadsheets, no
            paper trails, no arguments about the count.
          </p>
        </div>
      </div>

      {/* Phones and tablets get the usual contained grid. From lg the cards
          become a snap-aligned rail that runs wider than the container - the
          last card bleeds past it rather than stopping at the text column -
          but stops at 90% of the viewport, so the section still reads as part
          of the page instead of butting against both edges.
          
          The leading padding lines the first card up with the heading:
          within a rail of width W the heading's left edge sits at
          (W/0.9 - 72rem)/2 + 2.5rem from the viewport, and the rail itself
          starts 5.56% of W in, which reduces to 50% - 33.5rem. Percentages
          (not vw) keep the scrollbar out of the math, so the page never
          scrolls sideways, and the bar itself is hidden (`no-scrollbar`)
          since the half-visible next card already signals there is more. */}
      <div className="mx-auto mt-8 max-w-6xl px-6 md:px-10 lg:w-[90%] lg:max-w-none lg:px-0">
        <div className="no-scrollbar grid grid-cols-1 gap-5 md:grid-cols-2 lg:flex lg:snap-x lg:snap-mandatory lg:overflow-x-auto lg:ps-[max(0rem,calc(50%-33.5rem))]">
          {FEATURES.map((feature) => (
            <FeatureCard key={feature.number} {...feature} />
          ))}
        </div>
      </div>
    </section>
  );
}
