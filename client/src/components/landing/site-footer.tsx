"use client";

// Closing rule strip - the invitation on the left, one oversized arrow on the
// right, hairlines above and below - then the link columns and a slim bottom
// bar.
import { ArrowRight, ArrowUp } from "lucide-react";
import Link from "next/link";

import { Logo } from "@/components/brand/logo";
import { ThemeToggle } from "@/components/theme-toggle";

// Brand icons were removed from lucide-react v1; render them inline instead.
const FacebookIcon = ({ className }: { className?: string }) => (
  <svg
    aria-hidden="true"
    className={className}
    fill="currentColor"
    viewBox="0 0 24 24"
  >
    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
  </svg>
);

const LinkedinIcon = ({ className }: { className?: string }) => (
  <svg
    aria-hidden="true"
    className={className}
    fill="currentColor"
    viewBox="0 0 24 24"
  >
    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.225 0z" />
  </svg>
);

const YoutubeIcon = ({ className }: { className?: string }) => (
  <svg
    aria-hidden="true"
    className={className}
    fill="currentColor"
    viewBox="0 0 24 24"
  >
    <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
  </svg>
);

const COLUMNS = [
  {
    heading: "Product",
    links: [
      { href: "/#product", label: "Features" },
      { href: "/#how-it-works", label: "How it works" },
      { href: "/#security", label: "Security" },
      { href: "/#faq", label: "FAQ" },
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
  {
    heading: "Legal",
    links: [
      { href: "/privacy-policy", label: "Privacy Policy" },
      { href: "/terms-of-service", label: "Terms of Service" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="mt-auto w-full">
      {/* Closing rule strip */}
      <div className="border-y border-border">
        <div className="mx-auto flex w-full max-w-[100rem] flex-col gap-8 px-5 py-16 sm:flex-row sm:items-center sm:justify-between md:px-8 md:py-20 lg:px-12">
          <h2
            data-reveal
            className="display max-w-[22ch] text-[clamp(1.9rem,3.4vw,3rem)]"
          >
            Run an election nobody can dispute.
          </h2>
          <Link
            aria-label="Start an election"
            className="grid size-20 flex-none place-items-center border-[1.6px] border-foreground text-foreground transition-colors hover:bg-foreground hover:text-background md:size-24"
            href="/login"
          >
            <ArrowRight aria-hidden className="size-8 md:size-10" />
          </Link>
        </div>
      </div>

      {/* Link columns */}
      <div className="mx-auto grid w-full max-w-[100rem] gap-10 px-5 py-16 sm:grid-cols-2 md:px-8 lg:grid-cols-[1.3fr_repeat(4,minmax(0,1fr))] lg:px-12">
        <div className="max-w-xs">
          <Logo imgSize={30} textClassName="text-xl" />
          <p className="mt-4 leading-relaxed text-muted-foreground">
            The secure e-voting platform for organizations that need results
            everyone can stand behind.
          </p>
          {/* Social profiles (placeholders until the accounts exist). */}
          <div className="mt-6 flex items-center gap-2">
            {[
              { Icon: FacebookIcon, label: "Facebook" },
              { Icon: LinkedinIcon, label: "LinkedIn" },
              { Icon: YoutubeIcon, label: "YouTube" },
            ].map(({ Icon, label }) => (
              <a
                aria-label={label}
                className="grid size-10 place-items-center border border-border text-muted-foreground transition-colors hover:border-brand hover:text-brand"
                href="#"
                key={label}
              >
                <Icon className="size-4" />
              </a>
            ))}
          </div>
        </div>
        {COLUMNS.map((column) => (
          <nav aria-label={column.heading} key={column.heading}>
            <p className="font-display font-semibold">{column.heading}</p>
            <ul className="mt-4 space-y-2.5">
              {column.links.map((link) => (
                <li key={link.label}>
                  <Link
                    className="text-muted-foreground transition-colors hover:text-brand"
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

      {/* Bottom bar */}
      <div className="border-t border-border">
        {/* Phones: everything centered, controls on their own row. From sm up:
            one row, copyright left and controls right. */}
        <div className="mx-auto flex w-full max-w-[100rem] flex-col items-center gap-4 px-5 py-6 text-center sm:flex-row sm:flex-wrap sm:justify-between sm:text-left md:px-8 lg:px-12">
          <p className="text-muted-foreground">
            {/* Each half is an unbreakable chunk: they share a line wherever
                both fit, and the credit drops down whole when they don't. */}
            <span className="inline-block whitespace-nowrap">
              © {new Date().getFullYear()} Elektor Pro.
            </span>{" "}
            <span className="inline-block whitespace-nowrap">
              Developed by{" "}
              <a
                className="font-semibold text-foreground transition-colors hover:text-brand"
                href="https://manuru.dev"
                rel="noopener noreferrer"
                target="_blank"
              >
                manuru
              </a>
            </span>
          </p>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <button
              className="flex items-center gap-2 transition-colors hover:text-brand"
              onClick={() => window.scrollTo({ behavior: "smooth", top: 0 })}
              type="button"
            >
              Scroll to top <ArrowUp aria-hidden className="size-4" />
            </button>
          </div>
        </div>
      </div>
    </footer>
  );
}
