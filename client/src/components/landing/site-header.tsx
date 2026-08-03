"use client";

// Transparent text-first navigation in the portfolio's language: wordmark on
// the left, semibold text links on the right, and a "Menu" text toggle (not a
// hamburger icon) opening a full-screen overlay on phones.
import Link from "next/link";
import { useState } from "react";

import { ThemeToggle } from "@/components/theme/theme-toggle";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "#product", label: "Product" },
  { href: "#how-it-works", label: "How it works" },
  { href: "#security", label: "Security" },
  { href: "#faq", label: "FAQ" },
  { href: "/vote", label: "Vote" },
  { href: "/login", label: "Sign in" },
];

export function SiteHeader() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <nav>
      <div className="mx-auto max-w-6xl px-6 pt-8 pb-4 md:px-12">
        <div className="flex items-center justify-between">
          <Link className="text-2xl font-semibold tracking-tight" href="/">
            Elektor<span className="text-brand">Pro</span>
          </Link>

          <div className="hidden items-center gap-1 md:flex">
            {NAV_ITEMS.map((item) => (
              <Link
                className="p-2 text-lg font-semibold text-foreground transition-colors hover:text-muted-foreground"
                href={item.href}
                key={item.label}
              >
                {item.label}
              </Link>
            ))}
            <ThemeToggle className="ml-2 size-9 border border-border" />
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
          <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col justify-center gap-2 px-6">
            {NAV_ITEMS.map((item) => (
              <Link
                className="py-2 text-3xl font-medium text-foreground transition-colors hover:text-muted-foreground"
                href={item.href}
                key={item.label}
                onClick={() => setMenuOpen(false)}
              >
                {item.label}
              </Link>
            ))}
            <div className="mt-6">
              <ThemeToggle className="size-10 border border-border" />
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
