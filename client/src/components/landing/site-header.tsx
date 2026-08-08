"use client";

// Text-first navigation derived from the portfolio's language, but with its
// own behavior: transparent at the top of the page, sticky with a blurred
// hairline once scrolled. Three tiers: phones get the "Menu"/"Close" toggle
// with a full-screen overlay; tablets (md-lg) drop the section tabs and show
// only the auth links, which is all that fits well there; from lg the full
// bar renders - section links apart from the actions ("Voter portal" as a
// quiet text link, "Sign in" as the single pill) so it stays airy.
import Link from "next/link";
import { useEffect, useState } from "react";

import { Logo } from "@/components/brand/logo";
import { cn } from "@/lib/utils";

const PAGE_LINKS = [
  { href: "/#product", label: "Product" },
  { href: "/#how-it-works", label: "How it works" },
  { href: "/#security", label: "Security" },
  { href: "/#faq", label: "FAQ" },
];

export function SiteHeader() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    // Two thresholds (hysteresis), not one: the compact header is ~20px
    // shorter, so with a single cutoff the height change itself moves the
    // page across the line and the header oscillates. The gap between the
    // thresholds is larger than the height delta, so a toggle can never
    // re-trigger itself.
    const onScroll = () => {
      const y = window.scrollY;
      setScrolled((prev) => (prev ? y > 8 : y > 56));
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  return (
    <header
      className={cn(
        "sticky top-0 z-40 transition-colors duration-300",
        scrolled && !menuOpen && "border-b border-border bg-background/85 backdrop-blur-md",
      )}
    >
      <div className="mx-auto max-w-6xl px-6 md:px-10">
        <div className={cn("flex items-center justify-between transition-all duration-300", scrolled ? "py-3.5" : "py-6")}>
          <Logo imgSize={34} textClassName="text-2xl" />

          {/* Page links, visually separate from the actions */}
          <div className="hidden items-center gap-6 lg:flex">
            {PAGE_LINKS.map((item) => (
              <Link
                className="text-base font-medium text-muted-foreground transition-colors hover:text-foreground"
                href={item.href}
                key={item.label}
              >
                {item.label}
              </Link>
            ))}
          </div>

          <div className="hidden items-center gap-5 md:flex">
            <Link
              className="text-base font-medium text-muted-foreground transition-colors hover:text-foreground"
              href="/vote"
            >
              Voter portal
            </Link>
            <Link
              className="rounded-full border border-foreground bg-foreground px-5 py-2 text-base font-medium text-background transition-colors duration-500 hover:bg-transparent hover:text-foreground"
              href="/login"
            >
              Sign in
            </Link>
          </div>

          <button
            aria-expanded={menuOpen}
            aria-label="Toggle menu"
            className={cn(
              "text-xl font-semibold text-foreground md:hidden",
              menuOpen && "z-50 text-muted-foreground",
            )}
            onClick={() => setMenuOpen((open) => !open)}
            type="button"
          >
            {menuOpen ? "Close" : "Menu"}
          </button>
        </div>
      </div>

      {/* Full-screen mobile menu */}
      {menuOpen && (
        <div className="fixed inset-0 z-40 flex flex-col bg-background md:hidden">
          <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col justify-center gap-1 px-6">
            {PAGE_LINKS.map((item) => (
              <Link
                className="py-2 text-3xl font-medium text-foreground transition-colors hover:text-muted-foreground"
                href={item.href}
                key={item.label}
                onClick={() => setMenuOpen(false)}
              >
                {item.label}
              </Link>
            ))}
            <div className="mt-8 flex flex-col gap-1 border-t border-border pt-8">
              <Link
                className="py-2 text-3xl font-medium text-muted-foreground transition-colors hover:text-foreground"
                href="/vote"
                onClick={() => setMenuOpen(false)}
              >
                Voter portal
              </Link>
              <Link
                className="py-2 text-3xl font-medium text-muted-foreground transition-colors hover:text-foreground"
                href="/login"
                onClick={() => setMenuOpen(false)}
              >
                Sign in
              </Link>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
