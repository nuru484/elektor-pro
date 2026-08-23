import { Logo } from "@/components/brand/logo";
import { SupportContact } from "@/components/brand/support-contact";
import { SkipLink } from "@/components/ui/skip-link";

export default function ResultsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <SkipLink targetId="results-main" />
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex h-16 max-w-4xl items-center justify-between px-4 sm:px-6">
          <Logo />
          <span className="text-xs font-medium text-muted-foreground">Live results</span>
        </div>
      </header>
      <main
        className="page-enter mx-auto w-full max-w-4xl flex-1 px-4 py-8 outline-none sm:px-6 sm:py-10"
        id="results-main"
        tabIndex={-1}
      >
        {children}
      </main>
      <footer className="border-t border-border">
        <div className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6">
          <SupportContact />
        </div>
      </footer>
    </div>
  );
}
