"use client";

// Election status changer: a native select offering only the transitions the
// backend state machine accepts from the current status, confirmed before
// applying. Used in the elections list and the election workspace header.
import { useState } from "react";
import { toast } from "sonner";

import type { Election, ElectionStatus } from "@/types/api";

import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { Select as NativeSelect } from "@/components/ui/input";
import { useSetElectionStatusMutation } from "@/redux/admin-api";
import { getApiErrorMessage } from "@/utils/extract-api-error";

import { legalNextStatuses, statusLabel } from "./election-lifecycle";

export function ElectionStatusControl({
  className,
  election,
}: {
  className?: string;
  election: Pick<Election, "id" | "name" | "status">;
}) {
  const [setElectionStatus] = useSetElectionStatusMutation();
  const [pendingStatus, setPendingStatus] = useState<ElectionStatus | null>(null);

  const nextStatuses = legalNextStatuses(election.status);

  const apply = async () => {
    if (!pendingStatus) return;
    setPendingStatus(null);
    try {
      const res = await setElectionStatus({
        id: election.id,
        status: pendingStatus,
      }).unwrap();
      toast.success(
        (res as { pending?: boolean }).pending
          ? "Change submitted for approval"
          : "Status updated",
      );
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Could not update status"));
    }
  };

  // A terminal status has nowhere to go; show it as plain text.
  if (nextStatuses.length === 0) {
    return (
      <span className="text-xs text-muted-foreground">
        {statusLabel(election.status)}
      </span>
    );
  }

  return (
    <>
      <NativeSelect
        aria-label={`Change status of ${election.name}`}
        className={className ?? "h-8 w-auto text-xs"}
        onChange={(e) => setPendingStatus(e.target.value as ElectionStatus)}
        title="Change the election's status - only allowed transitions are listed"
        value={election.status}
      >
        <option disabled value={election.status}>
          {statusLabel(election.status)}
        </option>
        {nextStatuses.map((status) => (
          <option key={status} value={status}>
            {statusLabel(status)}
          </option>
        ))}
      </NativeSelect>
      <ConfirmationDialog
        confirmText="Change status"
        description={`"${election.name}" will move from ${statusLabel(election.status)} to ${
          pendingStatus ? statusLabel(pendingStatus) : ""
        }. This affects what voters and agents can do right now.`}
        onConfirm={apply}
        onOpenChange={(open) => {
          if (!open) setPendingStatus(null);
        }}
        open={pendingStatus !== null}
        title="Change election status?"
      />
    </>
  );
}
