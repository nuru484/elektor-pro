"use client";

// Accreditor assignments: which elections each accreditor may check voters in
// for. Holding the ACCREDIT_VOTERS capability says a person can run a desk;
// this page says which desks. An accreditor with no assignment sees no
// elections at all, and the server refuses every accreditation call for an
// election they are not on - so this is access control, not a filter.
import { UserRoundCheck, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { EntityAvatar } from "@/components/console/entity-avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { Field } from "@/components/ui/field";
import { Select as NativeSelect } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState, PageHeader } from "@/components/ui/states";
import { useListElectionsQuery } from "@/redux/admin-api";
import {
  useAssignAccreditorMutation,
  useListAccreditorsQuery,
  useListStaffUsersQuery,
  useRemoveAccreditorMutation,
} from "@/redux/governance-api";
import { getApiErrorMessage } from "@/utils/extract-api-error";
import { EntityCardsSkeleton } from "@/components/console/skeletons";
import { formatDate } from "@/utils/format-date";

function AssignModal({ onClose, open }: { onClose: () => void; open: boolean }) {
  const [assign, { isLoading }] = useAssignAccreditorMutation();
  const { data: accreditorsData } = useListStaffUsersQuery({
    limit: 100,
    role: "ACCREDITOR",
  });
  const { data: electionsData } = useListElectionsQuery({ limit: 100 });
  const accreditors = accreditorsData?.data ?? [];
  const elections = electionsData?.data ?? [];

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const userId = String(form.get("userId") ?? "");
    const electionId = String(form.get("electionId") ?? "");
    if (!userId || !electionId) {
      toast.error("Pick an accreditor and an election");
      return;
    }
    try {
      await assign({ electionId, userId }).unwrap();
      toast.success("Accreditor assigned");
      onClose();
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Could not assign accreditor"));
    }
  };

  return (
    <Modal onClose={onClose} open={open} title="Assign an accreditor">
      <form className="space-y-4" onSubmit={(e) => void onSubmit(e)}>
        <Field label="Accreditor">
          <NativeSelect defaultValue="" name="userId">
            <option disabled value="">
              {accreditors.length === 0
                ? "No accreditor accounts yet"
                : "Select an accreditor…"}
            </option>
            {accreditors.map((user) => (
              <option key={user.id} value={user.id}>
                {user.firstName} {user.lastName}
                {user.email ? ` · ${user.email}` : ""}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field
          hint="They will only be able to check voters in for the elections listed here."
          label="Election"
        >
          <NativeSelect defaultValue="" name="electionId">
            <option disabled value="">
              Select an election…
            </option>
            {elections.map((election) => (
              <option key={election.id} value={election.id}>
                {election.name}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <div className="flex justify-end gap-2">
          <Button onClick={onClose} type="button" variant="outline">
            Cancel
          </Button>
          <Button loading={isLoading} type="submit" variant="brand">
            Assign
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export default function AccreditorsPage() {
  const [assignOpen, setAssignOpen] = useState(false);
  const [removing, setRemoving] = useState<null | {
    election: string;
    id: string;
    name: string;
  }>(null);

  const { data, isLoading } = useListAccreditorsQuery({ limit: 100 });
  const [remove] = useRemoveAccreditorMutation();
  const rows = data?.data ?? [];

  const doRemove = async () => {
    if (!removing) return;
    try {
      await remove(removing.id).unwrap();
      toast.success("Assignment removed");
      setRemoving(null);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Could not remove assignment"));
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        action={
          <Button
            onClick={() => {
              setAssignOpen(true);
            }}
            variant="brand"
          >
            <Plus className="size-4" /> Assign accreditor
          </Button>
        }
        description="Choose which elections each accreditor can check voters in for. Without an assignment, an accreditor sees no elections."
        title="Accreditor assignments"
      />

      {isLoading ? (
        <EntityCardsSkeleton />
      ) : rows.length === 0 ? (
        <EmptyState
          description="Assign an accreditor to an election and it appears here. Until then, no accreditor can check anyone in."
          icon={UserRoundCheck}
          title="No assignments yet"
        />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {rows.map((row) => (
            <Card className="py-0" key={row.id}>
              <CardContent className="p-4">
                {/* Identity row. The avatar pairs with the name rather than
                    holding a column of its own down the whole card, which on a
                    phone left the text roughly forty per cent of the width and
                    pushed every line below it into a wrap. */}
                <div className="flex items-center gap-3">
                  <EntityAvatar
                    name={`${row.user.firstName} ${row.user.lastName}`}
                    url={row.user.profilePicture ?? null}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium [overflow-wrap:anywhere]">
                      {row.user.firstName} {row.user.lastName}
                    </p>
                    {row.user.email && (
                      <p className="truncate font-mono text-xs text-muted-foreground">
                        {row.user.email}
                      </p>
                    )}
                  </div>
                </div>

                {/* The election name is admin-authored free text and can run
                    long, so it takes the full width and wraps. */}
                <p className="mt-3 min-w-0 text-sm [overflow-wrap:anywhere]">
                  {row.election.name}
                </p>

                {/* The footer row carries everything short and fixed length -
                    status, the assignment date, and the one action - so none
                    of them claims a line of its own on a phone. The negative
                    margins let the button overhang the padding box so the row
                    stays as tall as its text. */}
                <div className="mt-2 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-muted-foreground">
                  <StatusBadge status={row.election.status} />
                  <span className="whitespace-nowrap">
                    Assigned {formatDate(row.createdAt)}
                  </span>
                  <Button
                    aria-label="Remove assignment"
                    className="-my-1.5 -mr-1.5 ml-auto shrink-0"
                    onClick={() => {
                      setRemoving({
                        election: row.election.name,
                        id: row.id,
                        name: `${row.user.firstName} ${row.user.lastName}`,
                      });
                    }}
                    size="icon-sm"
                    title="Remove this accreditor from the election"
                    variant="ghost"
                  >
                    <Trash2 aria-hidden className="size-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <AssignModal
        onClose={() => {
          setAssignOpen(false);
        }}
        open={assignOpen}
      />

      <ConfirmationDialog
        confirmText="Remove"
        description={
          removing
            ? `${removing.name} will no longer be able to accredit voters for ${removing.election}.`
            : ""
        }
        isDestructive
        onConfirm={() => void doRemove()}
        onOpenChange={(open) => {
          if (!open) setRemoving(null);
        }}
        open={removing !== null}
        title="Remove assignment?"
      />
    </div>
  );
}
