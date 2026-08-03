import Link from "next/link";

/** Slim wordmark header + centered column for authenticated voter views. */
export function VoterChrome({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header>
        <div className="mx-auto flex w-full max-w-2xl items-center justify-between px-6 pt-8 pb-4">
          <Link className="text-xl font-semibold tracking-tight" href="/">
            Elektor<span className="text-brand">Pro</span>
          </Link>
          <span className="text-sm font-medium text-muted-foreground">Voter portal</span>
        </div>
      </header>
      <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-6 sm:py-10">{children}</main>
    </div>
  );
}
