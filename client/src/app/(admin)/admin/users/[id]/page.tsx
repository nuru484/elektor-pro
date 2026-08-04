"use client";

// Account profile (staff and agents): the profile-style detail page admins
// open from any table's "View profile". Contact editing follows the trust
// ladder - super admins apply directly behind a typed confirmation; admins
// verify via a code sent to the NEW contact; self-service stays in /profile.
import { ArrowLeft, Mail, Pencil, Phone, ShieldAlert } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import type { StaffUser } from "@/types/api";

import {
  CARD_MOBILE,
  CARD_PAD_MOBILE,
} from "@/components/profile/details-section";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { CardGridSkeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/states";
import { StatusBadge } from "@/components/ui/status-badge";
import { useAuthRole } from "@/hooks/use-auth-role";
import {
  useConfirmUserContactMutation,
  useGetStaffUserQuery,
  useRequestUserContactMutation,
  useUpdateUserContactMutation,
} from "@/redux/governance-api";
import { getApiErrorMessage } from "@/utils/extract-api-error";

const ROLE_LABELS: Record<string, string> = {
  ACCREDITOR: "Accreditor",
  ADMIN: "Administrator",
  AGENT: "Agent",
  CANDIDATE: "Candidate",
  SUPER_ADMIN: "Super admin",
  VOTER: "Voter",
};

/** One contact channel (email or phone) with the role-appropriate editor. */
function ContactChannel({
  channel,
  current,
  user,
}: {
  channel: "email" | "phone";
  current: null | string;
  user: StaffUser;
}) {
  const { isSuperAdmin, user: me } = useAuthRole();
  const [stage, setStage] = useState<"code" | "editing" | "idle">("idle");
  const [value, setValue] = useState("");
  const [code, setCode] = useState("");
  const [confirming, setConfirming] = useState(false);

  const [updateDirect, { isLoading: saving }] = useUpdateUserContactMutation();
  const [request, { isLoading: requesting }] = useRequestUserContactMutation();
  const [confirm, { isLoading: verifying }] = useConfirmUserContactMutation();

  const isSelf = me?.id === user.id;
  const label = channel === "email" ? "Email" : "Phone";
  const Icon = channel === "email" ? Mail : Phone;

  const reset = () => {
    setStage("idle");
    setValue("");
    setCode("");
  };

  const applyDirect = async () => {
    setConfirming(false);
    try {
      await updateDirect({ id: user.id, [channel]: value }).unwrap();
      toast.success(`${label} updated`);
      reset();
    } catch (error) {
      toast.error(getApiErrorMessage(error));
    }
  };

  const sendCode = async () => {
    try {
      await request({ id: user.id, [channel]: value }).unwrap();
      toast.success(`Verification code sent to the new ${channel}`);
      setStage("code");
    } catch (error) {
      toast.error(getApiErrorMessage(error));
    }
  };

  const applyVerified = async () => {
    try {
      await confirm({ code, id: user.id }).unwrap();
      toast.success(`${label} updated`);
      reset();
    } catch (error) {
      toast.error(getApiErrorMessage(error));
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Icon className="size-3.5" /> {label}
          </p>
          <p className="mt-0.5 truncate text-sm font-medium">{current ?? "—"}</p>
        </div>
        {!isSelf && stage === "idle" && (
          <Button onClick={() => setStage("editing")} size="sm" variant="outline">
            <Pencil className="size-3.5" /> Edit
          </Button>
        )}
      </div>

      {stage === "editing" && (
        <div className="max-w-md space-y-3 rounded-lg border border-border bg-muted/30 p-4">
          <Field
            hint={
              isSuperAdmin
                ? "Applies immediately after confirmation."
                : `A verification code goes to the new ${channel} - it must be live before it can be attached.`
            }
            label={`New ${channel}`}
          >
            <Input
              autoFocus
              onChange={(e) => setValue(e.target.value)}
              placeholder={channel === "email" ? "name@example.com" : "+233 24 000 0000"}
              type={channel === "email" ? "email" : "tel"}
              value={value}
            />
          </Field>
          <div className="flex gap-2">
            <Button onClick={reset} size="sm" type="button" variant="ghost">
              Cancel
            </Button>
            {isSuperAdmin ? (
              <Button
                disabled={!value}
                loading={saving}
                onClick={() => setConfirming(true)}
                size="sm"
                variant="brand"
              >
                Save {channel}
              </Button>
            ) : (
              <Button
                disabled={!value}
                loading={requesting}
                onClick={sendCode}
                size="sm"
                variant="brand"
              >
                Send verification code
              </Button>
            )}
          </div>
        </div>
      )}

      {stage === "code" && (
        <div className="max-w-md space-y-3 rounded-lg border border-border bg-muted/30 p-4">
          <Field
            hint={`Enter the code sent to ${value} to prove it's reachable.`}
            label="Verification code"
          >
            <Input
              autoFocus
              className="max-w-40"
              inputMode="numeric"
              onChange={(e) => setCode(e.target.value)}
              placeholder="123456"
              value={code}
            />
          </Field>
          <div className="flex gap-2">
            <Button onClick={reset} size="sm" type="button" variant="ghost">
              Cancel
            </Button>
            <Button
              disabled={!code}
              loading={verifying}
              onClick={applyVerified}
              size="sm"
              variant="brand"
            >
              Confirm change
            </Button>
          </div>
        </div>
      )}

      <ConfirmationDialog
        confirmText={`Update ${channel}`}
        description={`${user.firstName} ${user.lastName}'s ${channel} becomes "${value}" immediately, without verification. Make sure it is correct and reachable.`}
        isDestructive
        onConfirm={applyDirect}
        onOpenChange={(open) => !open && setConfirming(false)}
        open={confirming}
        requireExactMatch="update"
        title={`Change this ${channel}?`}
      />
    </div>
  );
}

export default function UserProfilePage() {
  const params = useParams<{ id: string }>();
  const { data, isError, isLoading } = useGetStaffUserQuery(params.id);
  const user = data?.data;

  return (
    <div className="space-y-6">
      <Link
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        href="/admin/users"
      >
        <ArrowLeft className="size-4" /> Back to users
      </Link>

      {isLoading ? (
        <CardGridSkeleton count={3} />
      ) : isError || !user ? (
        <ErrorState />
      ) : (
        <div className="space-y-6 max-sm:space-y-8">
          {/* Identity hero */}
          <Card className={CARD_MOBILE}>
            <CardContent className={`${CARD_PAD_MOBILE} flex items-center gap-4 py-6`}>
              <div className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-full border border-border bg-brand text-lg font-semibold text-brand-foreground">
                {user.profilePicture ? (
                  // eslint-disable-next-line @next/next/no-img-element -- Cloudinary avatar
                  <img
                    alt=""
                    className="size-full object-cover"
                    src={user.profilePicture}
                  />
                ) : (
                  `${user.firstName[0] ?? ""}${user.lastName[0] ?? ""}`.toUpperCase()
                )}
              </div>
              <div className="min-w-0">
                <h1 className="truncate text-xl font-semibold">
                  {user.firstName} {user.lastName}
                </h1>
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  <Badge variant="outline">{ROLE_LABELS[user.role] ?? user.role}</Badge>
                  <StatusBadge status={user.status} />
                  {user.lockedAt && (
                    <Badge variant="destructive">
                      <ShieldAlert className="size-3" /> locked
                    </Badge>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Contact - the trust-laddered editors */}
          <Card className={CARD_MOBILE}>
            <CardHeader className={CARD_PAD_MOBILE}>
              <CardTitle className="text-base">Contact</CardTitle>
              <CardDescription>
                How this person signs in and receives codes. Verified changes
                keep unreachable contacts out of the system.
              </CardDescription>
            </CardHeader>
            <CardContent className={`${CARD_PAD_MOBILE} space-y-5`}>
              <ContactChannel channel="email" current={user.email} user={user} />
              <ContactChannel channel="phone" current={user.phone} user={user} />
            </CardContent>
          </Card>

          {/* Account details */}
          <Card className={CARD_MOBILE}>
            <CardHeader className={CARD_PAD_MOBILE}>
              <CardTitle className="text-base">Account</CardTitle>
            </CardHeader>
            <CardContent className={CARD_PAD_MOBILE}>
              <dl className="grid gap-4 sm:grid-cols-2">
                <div>
                  <dt className="text-xs text-muted-foreground">Two-factor</dt>
                  <dd className="mt-0.5 text-sm font-medium">
                    {user.twoFactorEnabled ? "Enabled" : "Off"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Last sign-in</dt>
                  <dd className="mt-0.5 text-sm font-medium">
                    {user.lastLoginAt
                      ? new Date(user.lastLoginAt).toLocaleString()
                      : "Never"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Created</dt>
                  <dd className="mt-0.5 text-sm font-medium">
                    {new Date(user.createdAt).toLocaleDateString()}
                    {user.creator
                      ? ` by ${user.creator.firstName} ${user.creator.lastName}`
                      : ""}
                  </dd>
                </div>
                {user.mustChangePassword && (
                  <div>
                    <dt className="text-xs text-muted-foreground">Password</dt>
                    <dd className="mt-0.5 text-sm font-medium text-warning">
                      Temporary - not yet replaced
                    </dd>
                  </div>
                )}
              </dl>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
