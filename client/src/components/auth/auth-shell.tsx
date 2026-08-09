// src/components/auth/auth-shell.tsx
//
// The auth layout: a vertically centered rounded-2xl card whose header
// carries the brand lockup, then the title and subtitle, with the form body
// below and a back link under the card. Used by every authentication surface
// - staff login, 2FA, password flows, and the voter portal's sign-in stages.
//
// No site navbar here: a sign-in page has one job, and the landing nav
// (product, security, FAQ) is a set of exits from it. The logo inside the
// card carries the brand instead, and is itself the way home.
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

import { Logo } from "@/components/brand/logo";

interface AuthShellProps {
  backHref?: string;
  backLabel?: string;
  children: React.ReactNode;
  subtitle?: string;
  title?: string;
}

export function AuthShell({
  backHref = "/",
  backLabel = "Back to site",
  children,
  subtitle,
  title,
}: AuthShellProps) {
  return (
    <div className="flex min-h-dvh flex-col justify-center px-4 py-12">
      <div className="mx-auto w-full max-w-md">
        {/* The card dissolves on phones: no box-in-box padding, just the
            page gutter; the bordered card returns from sm up. */}
        <div className="overflow-hidden sm:rounded-2xl sm:border sm:border-border sm:bg-card">
          <div className="border-b border-border px-1 pt-2 pb-6 text-center sm:px-8 sm:pt-8">
            <div className="mb-5 flex justify-center">
              <Logo imgSize={34} textClassName="text-xl" />
            </div>
            {title && (
              <h1 className="text-2xl font-semibold tracking-tight text-foreground">
                {title}
              </h1>
            )}
            {subtitle && (
              <p className={`text-sm text-muted-foreground ${title ? "mt-1" : ""}`}>
                {subtitle}
              </p>
            )}
          </div>
          <div className="px-1 py-6 sm:px-8">{children}</div>
        </div>

        <div className="mt-6 text-center text-sm text-muted-foreground">
          <Link
            className="inline-flex items-center gap-1 transition-colors hover:text-foreground"
            href={backHref}
          >
            <ArrowLeft className="size-3.5" /> {backLabel}
          </Link>
        </div>
      </div>
    </div>
  );
}
