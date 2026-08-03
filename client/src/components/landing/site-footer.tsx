"use client";

// A full site footer in the shared design language: a large closing CTA with
// a muted-half heading and inversion pill button, then a proper multi-column
// footer (brand + link columns) over a hairline, and a slim bottom bar with
// scroll-to-top.
import { ArrowUp, ArrowUpRight } from "lucide-react";
import Link from "next/link";

const COLUMNS = [
  {
    heading: "Product",
    links: [
      { href: "#product", label: "Features" },
      { href: "#how-it-works", label: "How it works" },
      { href: "#security", label: "Security" },
      { href: "#faq", label: "FAQ" },
    ],
  },
  {
    heading: "For voters",
    links: [
      { href: "/vote", label: "Cast your vote" },
      { href: "/vote", label: "Verify a receipt" },
    ],
  },
  {
    heading: "For organizers",
    links: [
      { href: "/login", label: "Staff sign in" },
      { href: "/forgot-password", label: "Reset password" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="mt-auto w-full">
      {/* Closing CTA */}
      <div className="mx-auto mb-20 max-w-6xl px-6 text-center md:mb-24 md:px-10">
        <h2 className="mb-6 text-3xl font-medium leading-tight md:text-4xl">
          Run an election{" "}
          <span className="text-muted-foreground/60">nobody can dispute</span>
        </h2>
        <Link href="/login">
          <button
            className="inline-flex items-center gap-2 rounded-full border border-foreground bg-foreground px-8 py-4 text-base font-medium text-background transition-colors duration-500 hover:bg-transparent hover:text-foreground"
            type="button"
          >
            Start an election <ArrowUpRight className="size-4" />
          </button>
        </Link>
      </div>

      {/* Link columns */}
      <div className="border-t border-border">
        <div className="mx-auto grid max-w-6xl gap-10 px-6 py-14 md:grid-cols-[1.3fr_repeat(3,minmax(0,1fr))] md:px-10">
          <div className="max-w-xs">
            <Link className="text-xl font-semibold tracking-tight" href="/">
              Elektor<span className="text-brand">Pro</span>
            </Link>
            <p className="mt-3 leading-relaxed text-muted-foreground">
              The secure e-voting platform for organizations that need results
              everyone can stand behind.
            </p>
          </div>
          {COLUMNS.map((column) => (
            <nav aria-label={column.heading} key={column.heading}>
              <p className="font-medium">{column.heading}</p>
              <ul className="mt-4 space-y-2.5">
                {column.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      className="text-muted-foreground transition-colors hover:text-foreground"
                      href={link.href}
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>
      </div>

      {/* Bottom bar */}
      <div className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-6 md:px-10">
          <p className="text-muted-foreground">
            © {new Date().getFullYear()} Elektor Pro. Every ballot secret,
            every result provable.
          </p>
          <button
            className="flex items-center gap-2 transition-colors hover:text-muted-foreground"
            onClick={() => window.scrollTo({ behavior: "smooth", top: 0 })}
            type="button"
          >
            Scroll to top <ArrowUp className="size-4" />
          </button>
        </div>
      </div>
    </footer>
  );
}
