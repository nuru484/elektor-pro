"use client";

import { LogOut, UserCircle, Vote } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { useState } from "react";

import { Logo } from "@/components/brand/logo";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { clearSessionMarker } from "@/lib/session-marker";
import { useLogoutMutation } from "@/redux/auth-api";
import { SupportContact } from "@/components/brand/support-contact";

/**
 * The voter portal's chrome: wordmark plus a slim top navbar - the
 * elections link, then profile and sign-out behind an account menu - so
 * every voter page keeps the same light layout, no sidebar console. `nav`
 * is off only for the signed-out state.
 */
export function VoterChrome({
  children,
  nav = true,
}: {
  children: React.ReactNode;
  nav?: boolean;
}) {
  const pathname = usePathname();
  const [logout] = useLogoutMutation();
  const [confirmingLogout, setConfirmingLogout] = useState(false);

  const onLogout = async () => {
    try {
      await logout().unwrap();
    } catch {
      // Even a failed API logout clears this browser's state below.
    }
    clearSessionMarker();
    // Full reload drops every cached query and returns to the sign-in form.
    window.location.assign("/vote");
  };

  const linkCls = (href: string) =>
    cn(
      "inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium transition-colors",
      pathname === href
        ? "bg-accent text-foreground"
        : "text-muted-foreground hover:text-foreground",
    );

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex w-full max-w-2xl items-center justify-between gap-2 px-4 py-3 sm:px-6">
          <Logo href="/vote" imgSize={28} textClassName="max-[380px]:hidden text-lg" />
          {nav ? (
            <nav className="flex shrink-0 items-center gap-0.5">
              <Link className={linkCls("/vote")} href="/vote" title="Your elections">
                <Vote className="size-4" />
                <span className="max-[430px]:hidden">My elections</span>
              </Link>
              {/* Profile and sign-out live together behind the avatar, the
                  way an account menu is expected to work - and it keeps the
                  navbar to one visible action on a narrow phone. */}
              {/* Which console this is, immediately beside the account
                  menu: it describes who you are signed in as. */}
              <span className="mx-1 hidden shrink-0 border border-brand/40 bg-brand-muted px-2.5 py-0.5 text-[11px] font-medium whitespace-nowrap text-foreground sm:inline">
                Voter
              </span>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    aria-label="Account menu"
                    className="ml-1 flex size-8 items-center justify-center rounded-full bg-brand text-xs font-semibold text-brand-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    type="button"
                  >
                    <UserCircle className="size-4.5" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
                    Voter portal
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link href="/vote/profile">
                      <UserCircle className="size-4" /> My profile
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => {
                      setConfirmingLogout(true);
                    }}
                    variant="destructive"
                  >
                    <LogOut className="size-4" /> Sign out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </nav>
          ) : (
            <span className="text-sm font-medium text-muted-foreground">
              Voter portal
            </span>
          )}
        </div>
      </header>
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-6 sm:px-6 sm:py-10">
        {/* Keyed by route so the enter animation replays on navigation. */}
        <div className="page-enter" key={pathname}>
          {children}
        </div>
      </main>
      <footer className="mx-auto w-full max-w-2xl px-4 pb-8 sm:px-6">
        <SupportContact className="border-t border-border pt-6" />
      </footer>
      <ConfirmationDialog
        confirmText="Sign out"
        description="You will be signed out of the voter portal on this device."
        isDestructive
        onConfirm={() => {
          setConfirmingLogout(false);
          void onLogout();
        }}
        onOpenChange={setConfirmingLogout}
        open={confirmingLogout}
        title="Sign out?"
      />
    </div>
  );
}
