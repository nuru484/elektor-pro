"use client";

import { LogOut, UserCircle, Vote } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { useState } from "react";

import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { cn } from "@/lib/utils";
import { clearSessionMarker } from "@/lib/session-marker";
import { useLogoutMutation } from "@/redux/auth-api";

/**
 * The voter portal's chrome: wordmark plus a slim top navbar (elections,
 * profile, logout) so every voter page keeps the same light layout - no
 * sidebar console. `nav` is off only for the signed-out state.
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
          <Logo imgSize={28} textClassName="max-[380px]:hidden text-lg" />
          {nav ? (
            <nav className="flex shrink-0 items-center gap-0.5">
              <Link className={linkCls("/vote")} href="/vote" title="Your elections">
                <Vote className="size-4" />
                <span className="max-[430px]:hidden">My elections</span>
              </Link>
              <Link
                className={linkCls("/vote/profile")}
                href="/vote/profile"
                title="Your profile and security settings"
              >
                <UserCircle className="size-4" />
                <span className="max-[430px]:hidden">Profile</span>
              </Link>
              <Button
                onClick={() => {
                  setConfirmingLogout(true);
                }}
                size="sm"
                title="Sign out of the voter portal"
                variant="ghost"
              >
                <LogOut className="size-4" />
                <span className="max-[430px]:hidden">Log out</span>
              </Button>
            </nav>
          ) : (
            <span className="text-sm font-medium text-muted-foreground">
              Voter portal
            </span>
          )}
        </div>
      </header>
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-6 sm:px-6 sm:py-10">
        {children}
      </main>
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
