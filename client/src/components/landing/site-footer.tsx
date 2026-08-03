"use client";

// Portfolio-style footer: a large closing CTA with a muted-half heading and
// an inversion pill button, then a slim bottom bar with links, the theme
// toggle, and scroll-to-top.
import { ArrowUp, ArrowUpRight } from "lucide-react";
import Link from "next/link";

import { ThemeToggle } from "@/components/theme/theme-toggle";

export function SiteFooter() {
  return (
    <footer className="mt-auto w-full">
      <div className="mx-auto max-w-6xl">
        <div className="mb-16 px-6 text-center md:px-12">
          <h2 className="mb-6 text-3xl font-medium leading-tight md:text-4xl">
            Run an election{" "}
            <span className="text-muted-foreground/50">nobody can dispute</span>
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

        <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-7 text-center md:px-12">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <p className="text-muted-foreground">
              © {new Date().getFullYear()} Elektor Pro
            </p>
            <Link
              className="text-muted-foreground transition-colors hover:text-foreground"
              href="/vote"
            >
              Voter portal
            </Link>
            <Link
              className="text-muted-foreground transition-colors hover:text-foreground"
              href="/login"
            >
              Staff sign in
            </Link>
          </div>
          <div className="mx-auto flex items-center gap-3 md:mx-0">
            <ThemeToggle className="size-9 border border-border" />
            <button
              className="flex items-center gap-2 transition-colors hover:text-muted-foreground"
              onClick={() => window.scrollTo({ behavior: "smooth", top: 0 })}
              type="button"
            >
              Scroll to top <ArrowUp className="size-4" />
            </button>
          </div>
        </div>
      </div>
    </footer>
  );
}
