// Shared chrome and typography for the legal documents (/privacy-policy and
// /terms-of-service). Server component: the documents are static prose, so
// they ship no JS beyond the site chrome. The section helpers keep both
// pages on one type scale so the documents never drift apart visually.
import type { ReactNode } from "react";

import Link from "next/link";

import { SiteFooter } from "@/components/landing/site-footer";
import { SiteHeader } from "@/components/landing/site-header";
import { SkipLink } from "@/components/ui/skip-link";

export function LegalPageShell({
  children,
  crossLink,
  lastUpdated,
  title,
}: {
  children: ReactNode;
  crossLink: { href: string; label: string };
  lastUpdated: string;
  title: string;
}) {
  return (
    <div className="flex min-h-dvh flex-col">
      <SkipLink targetId="main-content" />
      <SiteHeader />
      <main className="flex-1 outline-none" id="main-content" tabIndex={-1}>
        <div className="mx-auto max-w-3xl px-6 py-12 md:px-10 md:py-16">
          <p className="font-mono text-xs font-bold tracking-[0.18em] uppercase text-brand">
            Elektor Pro · Legal
          </p>
          <h1 className="display mt-3 text-4xl lg:text-5xl">
            {title}
          </h1>
          <p className="mt-3 mb-10 text-sm text-muted-foreground">
            <span className="font-medium text-foreground">Last updated:</span>{" "}
            {lastUpdated}
          </p>

          {children}

          <div className="mt-14 border-t border-border pt-6 text-sm text-muted-foreground">
            <p>
              See also the <LegalLink href={crossLink.href}>{crossLink.label}</LegalLink>, or{" "}
              <LegalLink href="/">return to the landing page</LegalLink>.
            </p>
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}

/** A numbered document section with consistent spacing. */
export function LegalSection({
  children,
  title,
}: {
  children: ReactNode;
  title: string;
}) {
  return (
    <section className="mb-8">
      <h2 className="mb-3 text-xl font-semibold sm:text-2xl">{title}</h2>
      {children}
    </section>
  );
}

/** Body paragraph on the document's shared type style. */
export function LegalText({ children }: { children: ReactNode }) {
  return (
    <p className="mb-3 text-[15px] leading-relaxed text-muted-foreground">
      {children}
    </p>
  );
}

/** Bulleted list on the document's shared type style. */
export function LegalList({ items }: { items: ReactNode[] }) {
  return (
    <ul className="mb-3 ml-5 list-disc space-y-1.5 text-[15px] leading-relaxed text-muted-foreground">
      {items.map((item, index) => (
        <li key={index}>{item}</li>
      ))}
    </ul>
  );
}

/** Inline emphasis that reads as a label inside muted body text. */
export function LegalStrong({ children }: { children: ReactNode }) {
  return <strong className="font-semibold text-foreground">{children}</strong>;
}

/** Inline link with the document's shared link treatment. */
export function LegalLink({
  children,
  external = false,
  href,
}: {
  children: ReactNode;
  external?: boolean;
  href: string;
}) {
  const className =
    "font-medium text-foreground underline underline-offset-4 transition-colors hover:text-brand";
  return external ? (
    <a className={className} href={href} rel="noreferrer" target="_blank">
      {children}
    </a>
  ) : (
    <Link className={className} href={href}>
      {children}
    </Link>
  );
}
