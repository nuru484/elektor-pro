"use client";

// Signed-in devices: list with the current one flagged, revoke a single
// device, or sign out everywhere else.
import { Laptop, LogOut, Smartphone } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import type { SessionView } from "@/types/api";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CARD_MOBILE, CARD_PAD_MOBILE } from "@/components/profile/details-section";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/states";
import {
  useListSessionsQuery,
  useRevokeOtherSessionsMutation,
  useRevokeSessionMutation,
} from "@/redux/profile-api";
import { getApiErrorMessage } from "@/utils/extract-api-error";

const looksMobile = (userAgent: null | string): boolean =>
  /android|iphone|ipad|mobile/i.test(userAgent ?? "");

/** "Chrome on Windows"-style summary from a raw user agent. */
const describeDevice = (userAgent: null | string): string => {
  if (!userAgent) return "Unknown device";
  const browser =
    /edg\//i.test(userAgent) ? "Edge"
    : /firefox/i.test(userAgent) ? "Firefox"
    : /chrome/i.test(userAgent) ? "Chrome"
    : /safari/i.test(userAgent) ? "Safari"
    : "Browser";
  const os =
    /windows/i.test(userAgent) ? "Windows"
    : /android/i.test(userAgent) ? "Android"
    : /iphone|ipad|ios/i.test(userAgent) ? "iOS"
    : /mac os/i.test(userAgent) ? "macOS"
    : /linux/i.test(userAgent) ? "Linux"
    : "unknown OS";
  return `${browser} on ${os}`;
};

function SessionRow({ session }: { session: SessionView }) {
  const [revoke, { isLoading }] = useRevokeSessionMutation();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const Icon = looksMobile(session.userAgent) ? Smartphone : Laptop;

  return (
    <li className="flex items-center gap-3 py-3">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
        <Icon className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
          <span className="min-w-0 [overflow-wrap:anywhere]">
            {describeDevice(session.userAgent)}
          </span>
          {session.current && <Badge variant="brand">This device</Badge>}
        </p>
        <p className="text-xs text-muted-foreground [overflow-wrap:anywhere]">
          {session.ipAddress ?? "Unknown IP"} · active{" "}
          {new Date(session.lastUsedAt).toLocaleString()}
        </p>
      </div>
      {!session.current && (
        <>
          <Button
            aria-label="Sign this device out"
            loading={isLoading}
            onClick={() => setConfirmOpen(true)}
            size="sm"
            variant="outline"
          >
            Sign out
          </Button>
          <ConfirmationDialog
            confirmText="Sign device out"
            description={`${describeDevice(session.userAgent)} will be signed out and will need to log in again.`}
            isDestructive
            onConfirm={async () => {
              setConfirmOpen(false);
              try {
                await revoke(session.id).unwrap();
                toast.success("Device signed out");
              } catch (error) {
                toast.error(getApiErrorMessage(error));
              }
            }}
            onOpenChange={setConfirmOpen}
            open={confirmOpen}
            title="Sign this device out?"
          />
        </>
      )}
    </li>
  );
}

export function SessionsSection() {
  const { data, isError, isLoading } = useListSessionsQuery();
  const [revokeOthers, { isLoading: revokingOthers }] = useRevokeOtherSessionsMutation();
  const [confirmOthersOpen, setConfirmOthersOpen] = useState(false);

  const sessions = data?.data ?? [];
  const hasOthers = sessions.some((s) => !s.current);

  return (
    <Card className={CARD_MOBILE}>
      <CardHeader className={CARD_PAD_MOBILE}>
        <CardTitle className="text-base">Signed-in devices</CardTitle>
        <CardDescription>
          Everywhere your account is currently signed in. Sign out anything you
          don&apos;t recognize.
        </CardDescription>
      </CardHeader>
      <CardContent className={CARD_PAD_MOBILE}>
        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-14 w-full rounded-lg" />
            <Skeleton className="h-14 w-full rounded-lg" />
          </div>
        ) : isError ? (
          <ErrorState message="Could not load your sessions." />
        ) : (
          <>
            <ul className="divide-y divide-border">
              {sessions.map((session) => (
                <SessionRow key={session.id} session={session} />
              ))}
            </ul>
            {hasOthers && (
              <>
                <Button
                  className="mt-4"
                  loading={revokingOthers}
                  onClick={() => setConfirmOthersOpen(true)}
                  size="sm"
                  variant="outline"
                >
                  <LogOut className="size-4" /> Sign out everywhere else
                </Button>
                <ConfirmationDialog
                  confirmText="Sign out other devices"
                  description="Every device except this one will be signed out and will need to log in again."
                  isDestructive
                  onConfirm={async () => {
                    setConfirmOthersOpen(false);
                    try {
                      const result = await revokeOthers().unwrap();
                      toast.success(`Signed out ${result.data.revoked} other device(s)`);
                    } catch (error) {
                      toast.error(getApiErrorMessage(error));
                    }
                  }}
                  onOpenChange={setConfirmOthersOpen}
                  open={confirmOthersOpen}
                  title="Sign out everywhere else?"
                />
              </>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
