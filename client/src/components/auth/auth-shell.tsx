// src/components/auth/auth-shell.tsx
//
// The auth layout: a two-panel split. From lg a blue block holds the brand
// and the three things the platform guarantees; the form sits on the page
// field beside it, with the theme toggle pinned to its top corner. Below lg
// the block drops away entirely and the form takes the full width, because on
// a phone a decorative panel above a sign-in form is just something to scroll
// past.
//
// No site navbar here: a sign-in page has one job, and the landing nav
// (product, security, FAQ) is a set of exits from it. The logo carries the
// brand instead, and is itself the way home.
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

import { Logo } from "@/components/brand/logo";
import { ThemeToggle } from "@/components/theme-toggle";

interface AuthShellProps {
  backHref?: string;
  backLabel?: string;
  children: React.ReactNode;
  subtitle?: string;
  title?: string;
}

const ASSURANCES = [
  "Ballots are separated from voters as they are cast",
  "Every voter leaves with a receipt they can check",
  "Certified results cannot quietly change afterwards",
];

export function AuthShell({
  backHref = "/",
  backLabel = "Back to site",
  children,
  subtitle,
  title,
}: AuthShellProps) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[1.05fr_1fr]">
      {/* Brand block. aria-hidden: it repeats the marketing claims that the
          landing page already carries, and adds nothing to the task of
          signing in - a screen reader lands straight on the form. */}
      <aside
        aria-hidden
        className="relative hidden flex-col justify-between overflow-hidden bg-[radial-gradient(115%_115%_at_20%_10%,oklch(0.56_0.155_243)_0%,oklch(0.51_0.185_250)_46%,oklch(0.46_0.2_257)_100%)] p-12 text-white lg:flex xl:p-16"
      >
        <Logo href={null} imgSize={36} textClassName="text-2xl text-white" />

        <div>
          <p className="font-mono text-[11px] font-medium tracking-[0.2em] text-white uppercase">
            Elektor Pro
          </p>
          <p className="display mt-6 max-w-[14ch] text-[clamp(2.4rem,3.4vw,3.6rem)]">
            Run the vote. Publish the proof.
          </p>
        </div>

        <ul className="flex flex-col gap-3 border-t border-white/40 pt-8">
          {ASSURANCES.map((item) => (
            <li className="flex items-start gap-3 text-white" key={item}>
              <span className="mt-2.5 size-1.5 flex-none bg-white" />
              {item}
            </li>
          ))}
        </ul>
      </aside>

      {/* Form column */}
      <div className="relative flex flex-col justify-center px-5 py-12 sm:px-8 lg:px-14 xl:px-20">
        {/* Pinned rather than placed in the flow: the column is vertically
            centred, so anything in the flow would ride up and down with the
            form's height as it swaps between the sign-in and code stages. */}
        <div className="absolute top-4 right-4 sm:top-6 sm:right-6">
          <ThemeToggle />
        </div>

        <div className="mx-auto w-full max-w-md">
          <div className="lg:hidden">
            <Logo imgSize={34} textClassName="text-xl" />
          </div>

          <div className="mt-8 lg:mt-0">
            {title && (
              <h1 className="font-display text-3xl font-semibold md:text-4xl">
                {title}
              </h1>
            )}
            {subtitle && (
              <p
                className={`leading-relaxed text-muted-foreground ${title ? "mt-3" : ""}`}
              >
                {subtitle}
              </p>
            )}
          </div>

          <div className="mt-8">{children}</div>

          <div className="mt-10 border-t border-border pt-6 text-sm text-muted-foreground">
            <Link
              className="inline-flex items-center gap-1.5 transition-colors hover:text-brand"
              href={backHref}
            >
              <ArrowLeft aria-hidden className="size-3.5" /> {backLabel}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
