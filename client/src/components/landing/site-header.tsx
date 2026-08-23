"use client";

// Square-edged navigation bar: logo, section links, and a bordered sign-in
// button. Transparent over the page at rest, hairline-bordered and blurred
// once scrolled. Three tiers: phones get the "Menu"/"Close" toggle with a
// full-screen overlay; tablets (md-lg) drop the section links and show only
// the auth actions, which is all that fits well there; from lg the full bar
// renders.
import Link from "next/link";
import { useEffect, useState } from "react";

import { Logo } from "@/components/brand/logo";
import { cn } from "@/lib/utils";

const PAGE_LINKS = [
  { href: "/#product", label: "Product" },
  { href: "/#how-it-works", label: "How it works" },
  { href: "/#security", label: "Security" },
  { href: "/#faq", label: "FAQ" },
  { href: "/demo", label: "Live demo" },
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
        scrolled &&
          !menuOpen &&
          "border-b border-border bg-background/85 backdrop-blur-md",
      )}
    >
      <div className="mx-auto w-full max-w-[100rem] px-5 md:px-8 lg:px-12">
        <div
          className={cn(
            "flex items-center justify-between gap-8 transition-[padding] duration-300",
            scrolled ? "py-3.5" : "py-6",
          )}
        >
          <Logo imgSize={34} textClassName="text-2xl" />

          <nav
            aria-label="Sections"
            className="hidden items-center gap-9 lg:flex"
          >
            {PAGE_LINKS.map((item) => (
              <Link
                className="text-base font-medium text-foreground transition-colors hover:text-brand"
                href={item.href}
                key={item.label}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="hidden items-center gap-6 md:flex">
            <Link
              className="text-base font-medium text-muted-foreground transition-colors hover:text-foreground"
              href="/vote"
            >
              Voter portal
            </Link>
            <Link
              className="border-[1.6px] border-foreground px-6 py-2.5 text-base font-semibold text-foreground transition-colors duration-200 hover:bg-foreground hover:text-background"
              href="/login"
            >
              Sign in
            </Link>
          </div>

          <button
            aria-expanded={menuOpen}
            aria-label="Toggle menu"
            className={cn(
              "text-lg font-semibold text-foreground md:hidden",
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
          <div className="mx-auto flex w-full max-w-[100rem] flex-1 flex-col justify-center gap-1 px-5">
            {PAGE_LINKS.map((item) => (
              <Link
                className="font-display py-2 text-3xl font-medium text-foreground transition-colors hover:text-brand"
                href={item.href}
                key={item.label}
                onClick={() => setMenuOpen(false)}
              >
                {item.label}
              </Link>
            ))}
            <div className="mt-8 flex flex-col gap-1 border-t border-border pt-8">
              <Link
                className="font-display py-2 text-3xl font-medium text-muted-foreground transition-colors hover:text-foreground"
                href="/vote"
                onClick={() => setMenuOpen(false)}
              >
                Voter portal
              </Link>
              <Link
                className="font-display py-2 text-3xl font-medium text-muted-foreground transition-colors hover:text-foreground"
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
