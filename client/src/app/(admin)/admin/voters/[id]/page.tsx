"use client";

// Voter profile. Identity rail left, editable details right; ?edit=1 opens
// the form straight from the table. The photo updates on its own; field
// edits ride maker-checker (202 = staged for approval).
import { Pencil } from "lucide-react";
import { useParams, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { toast } from "sonner";

import type { Voter } from "@/types/api";

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
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { ErrorState, PageHeader } from "@/components/ui/states";
import {
  useGetVoterQuery,
  useUpdateVoterMutation,
  useUpdateVoterPictureMutation,
} from "@/redux/admin-api";
import { useListGroupsQuery } from "@/redux/governance-api";
import { getApiErrorMessage } from "@/utils/extract-api-error";
import { type FormErrors, isValidEmail, validateRequired } from "@/utils/form-validate";
import { formatDateTime } from "@/utils/format-date";

function VoterDetailsCard({
  editingInitially,
  voter,
}: {
  editingInitially: boolean;
  voter: Voter;
}) {
  const [editing, setEditing] = useState(editingInitially);
  const [errors, setErrors] = useState<FormErrors>({});
  const [update, { isLoading: saving }] = useUpdateVoterMutation();
  const { data: groupsData } = useListGroupsQuery({ limit: 100 }, { skip: !editing });
  const groups = groupsData?.data ?? [];
  const memberIds = new Set(voter.groupMemberships?.map((m) => m.group.id) ?? []);

  const onSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const errs = validateRequired(f, { name: "Full name", voterId: "Voter ID" });
    const email = String(f.get("email") ?? "");
    if (email && !isValidEmail(email)) errs.email = "Enter a valid email address";
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;
    try {
      const res = await update({
        data: {
          email: f.get("email") || null,
          groupIds: f.getAll("groupIds").map(String),
          name: f.get("name"),
          phoneNumber: f.get("phoneNumber") || null,
          voterId: f.get("voterId"),
        },
        id: voter.id,
      }).unwrap();
      toast.success(
        (res as { pending?: boolean }).pending
          ? "Submitted for approval"
          : "Voter updated",
      );
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
            <CardDescription>
              Contact and the group memberships that decide scoped eligibility.
            </CardDescription>
          </div>
          {!editing && (
            <Button onClick={() => setEditing(true)} size="sm" variant="outline">
              <Pencil className="size-3.5" /> Edit
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className={CARD_PAD_MOBILE}>
        {editing ? (
          <form className="max-w-lg space-y-4" noValidate onSubmit={onSave}>
            <Field error={errors.name} label="Full name">
              <Input defaultValue={voter.name} name="name" required />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field error={errors.voterId} label="Voter ID">
                <Input
                  className="font-mono"
                  defaultValue={voter.voterId}
                  name="voterId"
                  required
                />
              </Field>
              <Field label="Phone">
                <Input
                  defaultValue={voter.phoneNumber ?? ""}
                  name="phoneNumber"
                  placeholder="+233 24 000 0000"
                  type="tel"
                />
              </Field>
            </div>
            <Field error={errors.email} label="Email">
              <Input
                defaultValue={voter.email ?? ""}
                name="email"
                placeholder="name@example.com (optional)"
                type="email"
              />
            </Field>
            {groups.length > 0 && (
              <Field label="Groups">
                <div className="grid max-h-40 grid-cols-1 gap-1.5 overflow-y-auto rounded-lg border border-border p-3 sm:grid-cols-2">
                  {groups.map((group) => (
                    <label className="flex items-center gap-2 text-sm" key={group.id}>
                      <input
                        className="size-4 accent-brand"
                        defaultChecked={memberIds.has(group.id)}
                        name="groupIds"
                        type="checkbox"
                        value={group.id}
                      />
                      <span className="min-w-0 truncate">{group.name}</span>
                    </label>
                  ))}
                </div>
              </Field>
            )}
            <div className="flex gap-2">
              <Button onClick={() => setEditing(false)} type="button" variant="ghost">
                Cancel
              </Button>
              <Button loading={saving} type="submit" variant="brand">
                Save changes
              </Button>
            </div>
          </form>
        ) : (
          <dl className="grid gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-xs text-muted-foreground">Phone</dt>
              <dd className="mt-0.5 text-sm font-medium">{voter.phoneNumber ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Email</dt>
              <dd className="mt-0.5 break-words text-sm font-medium">
                {voter.email ?? "—"}
              </dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-xs text-muted-foreground">Groups</dt>
              <dd className="mt-1 flex flex-wrap gap-1.5">
                {voter.groupMemberships?.length ? (
                  voter.groupMemberships.map((membership) => (
                    <Badge key={membership.group.id} variant="outline">
                      {membership.group.name}
                    </Badge>
                  ))
                ) : (
                  <span className="text-sm text-muted-foreground">None</span>
                )}
              </dd>
            </div>
          </dl>
        )}
      </CardContent>
    </Card>
  );
}

function VoterProfileContent() {
  const params = useParams<{ id: string }>();
  const { data, isError, isLoading } = useGetVoterQuery(params.id);
  const [updatePicture] = useUpdateVoterPictureMutation();
  const searchParams = useSearchParams();
  const editInitially = searchParams.get("edit") === "1";
  const voter = data?.data;


  return (
    <div className="space-y-6">
      <PageHeader description="View and manage this voter." title="Voter profile" />

      {isLoading ? (
        <ProfileSkeleton />
      ) : isError || !voter ? (
        <ErrorState />
      ) : (
        <div className="gap-6 space-y-6 max-sm:space-y-8 lg:grid lg:grid-cols-[300px_1fr] lg:items-start lg:space-y-0">
          <Card className={`${CARD_MOBILE} lg:sticky lg:top-24`}>
            <CardContent
              className={`${CARD_PAD_MOBILE} flex flex-col items-center gap-3 py-6 text-center`}
            >
              <AvatarUpdater
                canEdit
                name={voter.name}
                onUpload={(file) => updatePicture({ file, id: voter.id }).unwrap()}
                url={voter.profilePicture}
              />
              <div className="min-w-0">
                <h1 className="truncate text-xl font-semibold">{voter.name}</h1>
                <p className="mt-0.5 font-mono text-sm text-muted-foreground">
                  {voter.voterId}
                </p>
              </div>
              <dl className="mt-2 w-full space-y-2.5 border-t border-border pt-4 text-left">
                <div className="flex items-baseline justify-between gap-3">
                  <dt className="text-xs text-muted-foreground">Registered</dt>
                  <dd className="text-xs font-medium">{formatDateTime(voter.createdAt)}</dd>
                </div>
                <div className="flex items-baseline justify-between gap-3">
                  <dt className="text-xs text-muted-foreground">Groups</dt>
                  <dd className="text-xs font-medium">
                    {voter.groupMemberships?.length ?? 0}
                  </dd>
                </div>
              </dl>
            </CardContent>
          </Card>

          <VoterDetailsCard editingInitially={editInitially} voter={voter} />
        </div>
      )}
    </div>
  );
}

export default function VoterProfilePage() {
  // useSearchParams needs a Suspense boundary for prerendering.
  return (
    <Suspense fallback={<ProfileSkeleton />}>
      <VoterProfileContent />
    </Suspense>
  );
}
