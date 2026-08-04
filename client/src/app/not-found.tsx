import { ArrowLeft } from "lucide-react";
import Link from "next/link";

import { Logo } from "@/components/brand/logo";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-6 py-20 text-center">
      <Logo href="/" imgSize={40} showText={false} />
      <p className="mt-8 text-sm font-medium tracking-[0.2em] text-muted-foreground uppercase">
        Error 404
      </p>
      <h1 className="mt-3 text-3xl font-medium md:text-4xl">
        This page isn&apos;t on the ballot.
      </h1>
      <p className="mt-4 max-w-md text-lg leading-relaxed text-muted-foreground">
        There&apos;s nothing at this address - it may have moved, or the link
        was copied wrong.
      </p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <Link
          className="inline-flex items-center gap-2 rounded-full border border-foreground bg-foreground px-6 py-3 text-base font-medium text-background transition-colors duration-500 hover:bg-transparent hover:text-foreground"
          href="/"
        >
          <ArrowLeft className="size-4" /> Back to the site
        </Link>
        <Link
          className="inline-flex items-center gap-2 rounded-full border border-foreground bg-transparent px-6 py-3 text-base font-medium text-foreground transition-colors duration-500 hover:bg-foreground hover:text-background"
          href="/vote"
        >
          Voter portal
        </Link>
      </div>
    </div>
  );
}
