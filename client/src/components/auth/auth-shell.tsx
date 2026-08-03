// src/components/auth/auth-shell.tsx
//
// The auth layout: a vertically centered rounded-2xl card with a bordered
// wordmark header (title + subtitle), the form body below, and a back link
// under the card. Used by every authentication surface - staff login, 2FA,
// password flows, and the voter portal's sign-in stages.
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

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
    <div className="flex min-h-dvh items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="overflow-hidden rounded-2xl border border-border bg-card">
          <div className="border-b border-border px-8 pt-8 pb-6 text-center">
            <Link
              className="inline-block text-xl font-semibold tracking-tight text-foreground"
              href="/"
            >
              Elektor<span className="text-brand">Pro</span>
            </Link>
            {title && (
              <h1 className="mt-4 text-2xl font-semibold tracking-tight text-foreground">
                {title}
              </h1>
            )}
            {subtitle && (
              <p className={`text-sm text-muted-foreground ${title ? "mt-1" : "mt-3"}`}>
                {subtitle}
              </p>
            )}
          </div>
          <div className="px-8 py-6">{children}</div>
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
