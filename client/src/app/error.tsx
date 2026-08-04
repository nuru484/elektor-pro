"use client";

import Link from "next/link";

import { Logo } from "@/components/brand/logo";

/** Route-segment error boundary - the failed-page state with a retry. */
export default function ErrorBoundary({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-6 py-20 text-center">
      <Logo href="/" imgSize={40} showText={false} />
      <h1 className="mt-8 text-3xl font-medium md:text-4xl">
        Something didn&apos;t go through.
      </h1>
      <p className="mt-4 max-w-md text-lg leading-relaxed text-muted-foreground">
        An unexpected error occurred on our side. Try again - if it keeps
        failing, contact your election administrator.
      </p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <button
          className="inline-flex items-center gap-2 rounded-full border border-foreground bg-foreground px-6 py-3 text-base font-medium text-background transition-colors duration-500 hover:bg-transparent hover:text-foreground"
          onClick={reset}
          type="button"
        >
          Try again
        </button>
        <Link
          className="inline-flex items-center gap-2 rounded-full border border-foreground bg-transparent px-6 py-3 text-base font-medium text-foreground transition-colors duration-500 hover:bg-foreground hover:text-background"
          href="/"
        >
          Back to the site
        </Link>
      </div>
    </div>
  );
}
