"use client";

import { LogOut, UserCircle } from "lucide-react";
import Link from "next/link";

import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";

/**
 * Slim wordmark header + centered column for authenticated voter views.
 * When signed in, the header carries the voter's profile link and logout -
 * the portal behaves like a real console, not a one-off page.
 */
export function VoterChrome({
  children,
  onLogout,
  signedInName,
}: {
  children: React.ReactNode;
  onLogout?: () => void;
  signedInName?: string;
}) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header>
        <div className="mx-auto flex w-full max-w-2xl items-center justify-between gap-3 px-6 pt-8 pb-4">
          <Logo imgSize={30} textClassName="text-xl" />
          {onLogout ? (
            <div className="flex shrink-0 items-center gap-1.5">
              <Link
                className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
                href="/profile"
                title={
                  signedInName
                    ? `Signed in as ${signedInName} - view your profile`
                    : "View your profile"
                }
              >
                <UserCircle className="size-4" /> My profile
              </Link>
              <Button
                onClick={onLogout}
                size="sm"
                title="Sign out of the voter portal"
                variant="outline"
              >
                <LogOut className="size-3.5" /> Log out
              </Button>
            </div>
          ) : (
            <span className="text-sm font-medium text-muted-foreground">
              Voter portal
            </span>
          )}
        </div>
      </header>
      <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-6 sm:py-10">{children}</main>
    </div>
  );
}
