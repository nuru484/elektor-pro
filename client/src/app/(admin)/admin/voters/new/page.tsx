"use client";

// Voter registration as a full page (the form outgrew a dialog): identity,
// contact, photo, and group memberships. Rides maker-checker - admins'
// submissions are staged for approval.
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { PhotoInput } from "@/components/console/photo-input";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/states";
import { useCreateVoterMutation } from "@/redux/admin-api";
import { useListGroupsQuery } from "@/redux/governance-api";
import { getApiErrorMessage } from "@/utils/extract-api-error";

export default function NewVoterPage() {
  const router = useRouter();
  const [createVoter, { isLoading: creating }] = useCreateVoterMutation();
  const [photo, setPhoto] = useState<File | null>(null);
  const { data: groupsData } = useListGroupsQuery({ limit: 100 });
  const groups = groupsData?.data ?? [];

  const onCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const body = new FormData();
    body.append("name", String(f.get("name")));
    body.append("voterId", String(f.get("voterId")));
    if (f.get("phoneNumber")) body.append("phoneNumber", String(f.get("phoneNumber")));
    if (f.get("email")) body.append("email", String(f.get("email")));
    for (const groupId of f.getAll("groupIds")) body.append("groupIds", String(groupId));
    if (photo) body.append("image", photo);
    try {
      const res = await createVoter(body).unwrap();
      toast.success(
        (res as { pending?: boolean }).pending ? "Submitted for approval" : "Voter added",
      );
      router.push("/admin/voters");
    } catch (error) {
      toast.error(getApiErrorMessage(error));
    }
  };

  return (
    <div className="space-y-6">
      <Link
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        href="/admin/voters"
      >
        <ArrowLeft className="size-4" /> Back to voters
      </Link>
      <PageHeader
        description="Register one voter. For many at once, use the bulk import."
        title="Add voter"
      />

      <form
        className="max-w-2xl space-y-5 sm:rounded-xl sm:border sm:border-border sm:bg-card sm:p-6"
        onSubmit={onCreate}
      >
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Full name">
            <Input name="name" placeholder="e.g. Ama Owusu" required />
          </Field>
          <Field hint="Index / membership number" label="Voter ID">
            <Input className="font-mono" name="voterId" placeholder="e.g. STU1234" required />
          </Field>
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field hint="Used to send their one-time login code" label="Phone number">
            <Input name="phoneNumber" placeholder="e.g. +233 24 000 0000" type="tel" />
          </Field>
          <Field hint="Fallback for their one-time login code" label="Email">
            <Input name="email" placeholder="e.g. ama@example.com (optional)" type="email" />
          </Field>
        </div>
        <PhotoInput file={photo} onChange={setPhoto} />
        {groups.length > 0 && (
          <Field
            hint="Group membership decides which scoped elections they can vote in."
            label="Groups"
          >
            <div className="grid max-h-56 grid-cols-1 gap-1.5 overflow-y-auto rounded-lg border border-border p-3 sm:grid-cols-2">
              {groups.map((group) => (
                <label className="flex items-center gap-2 text-sm" key={group.id}>
                  <input
                    className="size-4 accent-brand"
                    name="groupIds"
                    type="checkbox"
                    value={group.id}
                  />
                  <span className="min-w-0 truncate">
                    {group.name}
                    {group.category ? (
                      <span className="text-muted-foreground"> · {group.category.name}</span>
                    ) : null}
                  </span>
                </label>
              ))}
            </div>
          </Field>
        )}
        <div className="flex gap-2">
          <Button
            onClick={() => router.push("/admin/voters")}
            type="button"
            variant="ghost"
          >
            Cancel
          </Button>
          <Button loading={creating} type="submit" variant="brand">
            Add voter
          </Button>
        </div>
      </form>
    </div>
  );
}
