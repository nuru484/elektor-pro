import { ArrowRight } from "lucide-react";
import Link from "next/link";

export function Cta() {
  return (
    <section className="mx-auto w-full max-w-6xl px-4 pb-20 sm:px-6">
      <div className="relative overflow-hidden rounded-3xl border border-border bg-card px-6 py-14 text-center sm:px-12">
        <div className="pointer-events-none absolute inset-0 bg-ambient opacity-70" />
        <div className="relative">
          <h2 className="mx-auto max-w-2xl text-2xl font-semibold tracking-tight sm:text-4xl">
            Ready to run an election nobody can dispute?
          </h2>
          <p className="mx-auto mt-4 max-w-xl leading-relaxed text-muted-foreground">
            Set up your first election in an afternoon - and give your members
            results they can verify for themselves.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              className="inline-flex items-center gap-2 whitespace-nowrap rounded-full bg-brand px-7 py-3 text-sm font-medium text-brand-foreground transition-colors hover:bg-brand/90 sm:text-base"
              href="/login"
            >
              Start an election <ArrowRight className="size-4" />
            </Link>
            <Link
              className="inline-flex items-center gap-2 whitespace-nowrap rounded-full border border-border bg-background px-7 py-3 text-sm font-medium transition-colors hover:bg-accent sm:text-base"
              href="/vote"
            >
              Voter portal
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
