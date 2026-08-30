"use client";

// Voter registration as a full page (the form outgrew a dialog): identity,
// contact, photo, and the election(s) the voter is being registered into.
// Registration is always INTO an election - picking a group-scoped election
// unfolds its groups so the voter is placed in their category/group at the
// same time. Rides maker-checker - admins' submissions are staged.
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import type { Election } from "@/types/api";

import { PhotoInput } from "@/components/console/photo-input";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/states";
import { useCreateVoterMutation, useListElectionsQuery } from "@/redux/admin-api";
import { getApiErrorMessage } from "@/utils/extract-api-error";
import { type FormErrors, isValidEmail, validateRequired } from "@/utils/form-validate";

/** Elections a voter can still be registered into. */
const OPEN_STATUSES = new Set(["DRAFT", "SCHEDULED", "IN_PROGRESS", "PAUSED"]);

export default function NewVoterPage() {
  const router = useRouter();
  const [createVoter, { isLoading: creating }] = useCreateVoterMutation();
  const [photo, setPhoto] = useState<File | null>(null);
  const [errors, setErrors] = useState<FormErrors>({});
  const [selectedElections, setSelectedElections] = useState<Set<string>>(
    new Set(),
  );
  const { data: electionsData } = useListElectionsQuery({ limit: 100 });
  const elections = (electionsData?.data ?? []).filter((election) =>
    OPEN_STATUSES.has(election.status),
  );

  const toggleElection = (id: string) => {
    setSelectedElections((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const groupsOf = (election: Election) =>
    (election.eligibilityGroups ?? []).map((entry) => entry.group);

  const onCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const errs = validateRequired(f, { name: "Full name", voterId: "Voter ID" });
    const email = String(f.get("email") ?? "");
    if (email && !isValidEmail(email)) errs.email = "Enter a valid email address";
    if (selectedElections.size === 0) {
      errs.elections = "Select at least one election for this voter";
    }
    // A group-scoped election needs the voter placed in one of its groups.
    const chosenGroups = new Set(f.getAll("groupIds").map(String));
    for (const election of elections) {
      if (!selectedElections.has(election.id)) continue;
      const scoped = groupsOf(election);
      if (scoped.length > 0 && !scoped.some((g) => chosenGroups.has(g.id))) {
        errs.elections = `Pick the voter's group for "${election.name}"`;
        break;
      }
    }
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    const body = new FormData();
    body.append("name", String(f.get("name")));
    body.append("voterId", String(f.get("voterId")));
    if (f.get("phoneNumber")) body.append("phoneNumber", String(f.get("phoneNumber")));
    if (f.get("email")) body.append("email", String(f.get("email")));
    for (const electionId of selectedElections) body.append("electionIds", electionId);
    for (const groupId of chosenGroups) body.append("groupIds", groupId);
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
      <PageHeader
        backHref="/admin/voters"
        backLabel="Back to voters"
        description="Register one voter into their election(s). For many at once, use the bulk import."
        title="Add voter"
      />

      <form
        className="max-w-2xl space-y-5 sm:rounded-xl sm:border sm:border-border sm:bg-card sm:p-6"
        noValidate
        onSubmit={onCreate}
      >
        <div className="grid gap-5 sm:grid-cols-2">
          <Field error={errors.name} label="Full name">
            <Input name="name" placeholder="e.g. Ama Owusu" required />
          </Field>
          <Field error={errors.voterId} hint="Index / membership number" label="Voter ID">
            <Input className="font-mono" name="voterId" placeholder="e.g. STU1234" required />
          </Field>
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field hint="Used to send their one-time login code" label="Phone number">
            <Input name="phoneNumber" placeholder="e.g. +233 24 000 0000" type="tel" />
          </Field>
          <Field error={errors.email} hint="Fallback for their one-time login code" label="Email">
            <Input name="email" placeholder="e.g. ama@example.com (optional)" type="email" />
          </Field>
        </div>
        <PhotoInput file={photo} onChange={setPhoto} />

        <Field
          error={errors.elections}
          hint="A voter always belongs to at least one election. Group-scoped elections ask for the voter's group - they can be in a category without being in all of its groups."
          label="Elections"
        >
          {elections.length === 0 ? (
            <p className="rounded-lg border border-border p-3 text-sm text-muted-foreground">
              No open elections to register into yet - create an election first.
            </p>
          ) : (
            <div className="max-h-72 space-y-1.5 overflow-y-auto rounded-lg border border-border p-3">
              {elections.map((election) => {
                const checked = selectedElections.has(election.id);
                const scoped = groupsOf(election);
                return (
                  <div key={election.id}>
                    <label
                      className="flex items-center gap-2 text-sm"
                      title={
                        scoped.length > 0
                          ? "Scoped election: pick the voter's group below"
                          : "Open to all registered voters"
                      }
                    >
                      <input
                        checked={checked}
                        className="size-4 accent-brand"
                        onChange={() => {
                          toggleElection(election.id);
                        }}
                        type="checkbox"
                      />
                      <span className="min-w-0 [overflow-wrap:anywhere]">
                        {election.name}
                      </span>
                    </label>
                    {checked && scoped.length > 0 && (
                      <div className="mt-1.5 mb-1 ml-6 space-y-1 border-l border-border pl-3">
                        <p className="text-xs text-muted-foreground">
                          Their group in this election:
                        </p>
                        {scoped.map((group) => (
                          <label
                            className="flex items-center gap-2 text-sm"
                            key={`${election.id}:${group.id}`}
                          >
                            <input
                              className="size-4 accent-brand"
                              name="groupIds"
                              type="checkbox"
                              value={group.id}
                            />
                            <span className="min-w-0 [overflow-wrap:anywhere]">
                              {group.name}
                              {group.category ? (
                                <span className="text-muted-foreground">
                                  {" "}
                                  · {group.category.name}
                                </span>
                              ) : null}
                            </span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </Field>

        <div className="flex gap-2">
          <Button
            onClick={() => router.push("/admin/voters")}
            type="button"
            variant="outline"
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
