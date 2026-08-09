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
import { TableDate } from "@/components/console/table-date";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { Field } from "@/components/ui/field";
import { Select as NativeSelect } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Skeleton } from "@/components/ui/skeleton";
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
        <Skeleton className="h-40 rounded-xl" />
      ) : rows.length === 0 ? (
        <EmptyState
          description="Assign an accreditor to an election and it appears here. Until then, no accreditor can check anyone in."
          icon={UserRoundCheck}
          title="No assignments yet"
        />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {rows.map((row) => (
            <Card key={row.id}>
              <CardContent className="flex items-start justify-between gap-3 p-4">
                <div className="flex min-w-0 items-start gap-3">
                  <EntityAvatar
                    name={`${row.user.firstName} ${row.user.lastName}`}
                    url={row.user.profilePicture ?? null}
                  />
                  <div className="min-w-0">
                    <p className="text-sm font-medium [overflow-wrap:anywhere]">
                      {row.user.firstName} {row.user.lastName}
                    </p>
                    {row.user.email && (
                      <p className="truncate font-mono text-xs text-muted-foreground">
                        {row.user.email}
                      </p>
                    )}
                    <p className="mt-1.5 flex flex-wrap items-center gap-1.5 text-sm">
                      <span className="[overflow-wrap:anywhere]">
                        {row.election.name}
                      </span>
                      <StatusBadge status={row.election.status} />
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Assigned <TableDate value={row.createdAt} />
                    </p>
                  </div>
                </div>
                <Button
                  aria-label="Remove assignment"
                  onClick={() => {
                    setRemoving({
                      election: row.election.name,
                      id: row.id,
                      name: `${row.user.firstName} ${row.user.lastName}`,
                    });
                  }}
                  size="sm"
                  title="Remove this accreditor from the election"
                  variant="ghost"
                >
                  <Trash2 className="size-4" />
                </Button>
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
