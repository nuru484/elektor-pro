"use client";

// Account profile (staff and agents). Two-column on desktop so the space
// works: identity rail left, editable details right. Opening with ?edit=1
// (the tables' Edit action) activates the form straight away. The photo
// updates on its own; contact edits follow the trust ladder - super admins
// apply directly behind a typed confirmation, admins verify via a code sent
// to the NEW contact.
import { Mail, Pencil, Phone, ShieldAlert } from "lucide-react";
import { useParams, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { toast } from "sonner";

import type { StaffUser } from "@/types/api";

import { AvatarUpdater } from "@/components/console/avatar-updater";
import { ProfileSkeleton } from "@/components/console/profile-skeleton";
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
import { Input, Select as NativeSelect } from "@/components/ui/input";
import { ErrorState, PageHeader } from "@/components/ui/states";
import { StatusBadge } from "@/components/ui/status-badge";
import { useAuthRole } from "@/hooks/use-auth-role";
import {
  useConfirmUserContactMutation,
  useGetStaffUserQuery,
  useRequestUserContactMutation,
  useUpdateStaffUserMutation,
  useUpdateUserContactMutation,
  useUpdateUserPictureMutation,
} from "@/redux/governance-api";
import { getApiErrorMessage } from "@/utils/extract-api-error";
import { formatDateTime } from "@/utils/format-date";
import { type FormErrors, validateRequired } from "@/utils/form-validate";

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
          {/* Never bare `truncate` here: nowrap makes the full value the
              min-content width and stretches the page. Wrap instead - the
              whole contact must stay readable on the profile. */}
          <p className="mt-0.5 min-w-0 text-sm font-medium [overflow-wrap:anywhere]">
            {current ?? "—"}
          </p>
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
          <div className="flex flex-wrap gap-2">
            <Button onClick={reset} size="sm" type="button" variant="outline">
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
            <Button onClick={reset} size="sm" type="button" variant="outline">
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

/** Names (+ status for admins) - the form ?edit=1 activates. */
function DetailsCard({
  editingInitially,
  user,
}: {
  editingInitially: boolean;
  user: StaffUser;
}) {
  const { isAdmin, user: me } = useAuthRole();
  const [editing, setEditing] = useState(editingInitially);
  const [errors, setErrors] = useState<FormErrors>({});
  const [update, { isLoading: saving }] = useUpdateStaffUserMutation();
  const isSelf = me?.id === user.id;

  const onSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const errs = validateRequired(f, {
      firstName: "First name",
      lastName: "Last name",
    });
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;
    try {
      await update({
        data: {
          firstName: f.get("firstName"),
          lastName: f.get("lastName"),
          ...(isAdmin && !isSelf ? { status: f.get("status") } : {}),
        },
        id: user.id,
      }).unwrap();
      toast.success("Details updated");
      setEditing(false);
    } catch (error) {
      toast.error(getApiErrorMessage(error));
    }
  };

  return (
    <Card className={CARD_MOBILE}>
      <CardHeader className={CARD_PAD_MOBILE}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base">Details</CardTitle>
            <CardDescription>Names and account status.</CardDescription>
          </div>
          {!editing && !isSelf && (
            <Button onClick={() => setEditing(true)} size="sm" variant="outline">
              <Pencil className="size-3.5" /> Edit
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className={CARD_PAD_MOBILE}>
        {editing ? (
          <form className="space-y-4" noValidate onSubmit={onSave}>
            {/* One desktop row: first name, last name, status. */}
            <div className="grid max-w-2xl gap-3 sm:grid-cols-3">
              <Field error={errors.firstName} label="First name">
                <Input defaultValue={user.firstName} name="firstName" required />
              </Field>
              <Field error={errors.lastName} label="Last name">
                <Input defaultValue={user.lastName} name="lastName" required />
              </Field>
              {isAdmin && !isSelf && (
                <Field
                  hint="Suspending signs the user out everywhere."
                  label="Status"
                >
                  <NativeSelect
                    defaultValue={user.status === "LOCKED" ? "ACTIVE" : user.status}
                    name="status"
                  >
                    <option value="ACTIVE">Active</option>
                    <option value="INACTIVE">Inactive</option>
                    <option value="SUSPENDED">Suspended</option>
                  </NativeSelect>
                </Field>
              )}
            </div>
            <div className="flex gap-2">
              <Button onClick={() => setEditing(false)} type="button" variant="outline">
                Cancel
              </Button>
              <Button loading={saving} type="submit" variant="brand">
                Save changes
              </Button>
            </div>
          </form>
        ) : (
          <dl className="grid gap-4 sm:grid-cols-2">
            <div className="min-w-0">
              <dt className="text-xs text-muted-foreground">First name</dt>
              <dd className="mt-0.5 min-w-0 text-sm font-medium [overflow-wrap:anywhere]">
                {user.firstName}
              </dd>
            </div>
            <div className="min-w-0">
              <dt className="text-xs text-muted-foreground">Last name</dt>
              <dd className="mt-0.5 min-w-0 text-sm font-medium [overflow-wrap:anywhere]">
                {user.lastName}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Role</dt>
              <dd className="mt-1">
                <Badge variant="outline">{ROLE_LABELS[user.role] ?? user.role}</Badge>
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Status</dt>
              <dd className="mt-1 flex items-center gap-1.5">
                <StatusBadge status={user.status} />
                {user.lockedAt && user.status !== "LOCKED" && (
                  <Badge variant="destructive">
                    <ShieldAlert className="size-3" /> locked
                  </Badge>
                )}
              </dd>
            </div>
          </dl>
        )}
      </CardContent>
    </Card>
  );
}

function UserProfileContent() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const editInitially = searchParams.get("edit") === "1";
  const { data, isError, isLoading } = useGetStaffUserQuery(params.id);
  const [updatePicture] = useUpdateUserPictureMutation();
  const user = data?.data;


  return (
    <div className="space-y-6">
      <PageHeader
        backHref="/admin/users"
        backLabel="Back to users"
        description="View and manage this account."
        title="User profile"
      />

      {isLoading ? (
        <ProfileSkeleton />
      ) : isError || !user ? (
        <ErrorState />
      ) : (
        <div className="gap-6 space-y-6 max-sm:space-y-8 lg:grid lg:grid-cols-[300px_1fr] lg:items-start lg:space-y-0">
          {/* Identity rail */}
          <Card className={`${CARD_MOBILE} lg:sticky lg:top-24`}>
            <CardContent
              className={`${CARD_PAD_MOBILE} flex flex-col items-center gap-3 py-6 text-center`}
            >
              <AvatarUpdater
                canEdit
                name={`${user.firstName} ${user.lastName}`}
                onUpload={(file) => updatePicture({ file, id: user.id }).unwrap()}
                url={user.profilePicture}
              />
              <h1 className="min-w-0 max-w-full text-xl font-semibold [overflow-wrap:anywhere]">
                {user.firstName} {user.lastName}
              </h1>
              <dl className="mt-2 w-full space-y-2.5 border-t border-border pt-4 text-left">
                <div className="flex items-baseline justify-between gap-3">
                  <dt className="text-xs text-muted-foreground">Two-factor</dt>
                  <dd className="text-xs font-medium">
                    {user.twoFactorEnabled ? "Enabled" : "Off"}
                  </dd>
                </div>
                <div className="flex items-baseline justify-between gap-3">
                  <dt className="text-xs text-muted-foreground">Last sign-in</dt>
                  <dd className="text-xs font-medium">{formatDateTime(user.lastLoginAt)}</dd>
                </div>
                <div className="flex items-baseline justify-between gap-3">
                  <dt className="text-xs text-muted-foreground">Created</dt>
                  <dd className="text-xs font-medium">{formatDateTime(user.createdAt)}</dd>
                </div>
                {user.creator && (
                  <div className="flex items-baseline justify-between gap-3">
                    <dt className="text-xs text-muted-foreground">Created by</dt>
                    <dd className="truncate text-xs font-medium">
                      {user.creator.firstName} {user.creator.lastName}
                    </dd>
                  </div>
                )}
                {user.mustChangePassword && (
                  <div className="flex items-baseline justify-between gap-3">
                    <dt className="text-xs text-muted-foreground">Password</dt>
                    <dd className="text-xs font-medium text-warning">Temporary</dd>
                  </div>
                )}
              </dl>
            </CardContent>
          </Card>

          {/* Editable content. min-w-0: the 1fr grid column must be allowed
              to shrink, or one long unbroken value stretches the page. */}
          <div className="min-w-0 space-y-6 max-sm:space-y-8">
            <DetailsCard editingInitially={editInitially} user={user} />
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
          </div>
        </div>
      )}
    </div>
  );
}

export default function UserProfilePage() {
  // useSearchParams needs a Suspense boundary for prerendering.
  return (
    <Suspense fallback={<ProfileSkeleton />}>
      <UserProfileContent />
    </Suspense>
  );
}
