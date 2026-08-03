import Link from "next/link";

import { Logo } from "@/components/brand/logo";

const COLUMNS = [
  {
    heading: "Product",
    links: [
      { href: "#product", label: "Features" },
      { href: "#how-it-works", label: "How it works" },
      { href: "#security", label: "Security" },
      { href: "#faq", label: "FAQ" },
    ],
  },
  {
    heading: "For voters",
    links: [
      { href: "/vote", label: "Cast your vote" },
      { href: "/vote", label: "Verify a receipt" },
    ],
  },
  {
    heading: "For organizers",
    links: [
      { href: "/login", label: "Staff sign in" },
      { href: "/forgot-password", label: "Reset password" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-card/50">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-[1.2fr_repeat(3,minmax(0,1fr))]">
        <div className="max-w-xs">
          <Logo />
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            The secure e-voting platform for organizations that need results
            everyone can stand behind.
          </p>
        </div>
        {COLUMNS.map((column) => (
          <nav aria-label={column.heading} key={column.heading}>
            <p className="text-sm font-semibold">{column.heading}</p>
            <ul className="mt-3 space-y-2">
              {column.links.map((link) => (
                <li key={link.label}>
                  <Link
                    className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                    href={link.href}
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
      <div className="border-t border-border">
        <p className="mx-auto max-w-6xl px-4 py-5 text-xs text-muted-foreground sm:px-6">
          © {new Date().getFullYear()} Elektor Pro. Every ballot secret, every
          result provable.
        </p>
      </div>
    </footer>
  );
}
