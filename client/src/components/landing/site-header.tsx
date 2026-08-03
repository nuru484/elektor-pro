import Link from "next/link";

import { Logo } from "@/components/brand/logo";
import { LinkButton } from "@/components/ui/link-button";

const NAV_LINKS = [
  { href: "#product", label: "Product" },
  { href: "#how-it-works", label: "How it works" },
  { href: "#security", label: "Security" },
  { href: "#faq", label: "FAQ" },
];

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/80 backdrop-blur-md">
      <nav
        aria-label="Main"
        className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6"
      >
        <Logo />
        <div className="hidden items-center gap-8 text-sm text-muted-foreground md:flex">
          {NAV_LINKS.map((link) => (
            <Link
              className="transition-colors hover:text-foreground"
              href={link.href}
              key={link.href}
            >
              {link.label}
            </Link>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <LinkButton className="hidden sm:inline-flex" href="/vote" size="sm" variant="ghost">
            Voter portal
          </LinkButton>
          <LinkButton className="rounded-full px-4" href="/login" size="sm" variant="default">
            Sign in
          </LinkButton>
        </div>
      </nav>
    </header>
  );
}
