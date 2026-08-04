"use client";

// The runtime permission matrix (super-admin only): what each role may do,
// editable live. Rows are capabilities grouped by area; columns are the
// editable roles. Super-admins hold everything implicitly and voters never
// hold capabilities, so neither is a column.
import { ShieldCheck } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import type { Capability, PermissionsMatrix, Role } from "@/types/api";

import {
  buildMatrixState,
  changedRoles,
  hasCapabilityIn,
  type MatrixState,
  toggleCapability,
} from "@/components/console/permissions-matrix-logic";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { TableRowsSkeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState, PageHeader } from "@/components/ui/states";
import { useAuthRole } from "@/hooks/use-auth-role";
import {
  useGetPermissionsQuery,
  useUpdateRolePermissionsMutation,
} from "@/redux/admin-api";
import { getApiErrorMessage } from "@/utils/extract-api-error";

const ROLE_LABELS: Record<string, string> = {
  ACCREDITOR: "Accreditor",
  ADMIN: "Administrator",
  AGENT: "Agent",
  CANDIDATE: "Candidate",
};

function Matrix({ data }: { data: PermissionsMatrix }) {
  const [state, setState] = useState<MatrixState>(() => buildMatrixState(data.matrix));
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [update, { isLoading: saving }] = useUpdateRolePermissionsMutation();

  const dirtyRoles = changedRoles(data.matrix, state);

  const onToggle = (role: Role, capability: Capability) => {
    setState((current) => toggleCapability(current, role, capability));
  };

  const onSave = async () => {
    setConfirmOpen(false);
    for (const role of dirtyRoles) {
      try {
        await update({ capabilities: state[role] ?? [], role }).unwrap();
        toast.success(`${ROLE_LABELS[role] ?? role} permissions updated`);
      } catch (error) {
        toast.error(getApiErrorMessage(error, `Could not update ${role}`));
        return;
      }
    }
  };

  return (
    <div className="space-y-4">
      {/* Wide content scrolls inside its own container - the page never
          side-scrolls. */}
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full min-w-[600px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40">
              <th className="px-4 py-3 text-left font-medium">Capability</th>
              {data.editableRoles.map((role) => (
                <th className="px-3 py-3 text-center font-medium" key={role}>
                  {ROLE_LABELS[role] ?? role}
                </th>
              ))}
            </tr>
          </thead>
          {data.catalog.map((group) => (
            <tbody key={group.group}>
              <tr className="border-b border-border bg-muted/20">
                <td
                  className="px-4 py-2 text-[11px] font-medium tracking-[0.08em] text-muted-foreground uppercase"
                  colSpan={data.editableRoles.length + 1}
                >
                  {group.group}
                </td>
              </tr>
              {group.capabilities.map((meta) => (
                <tr className="border-b border-border last:border-b-0" key={meta.capability}>
                  <td className="px-4 py-3">
                    <p className="font-medium">{meta.label}</p>
                    <p className="mt-0.5 max-w-[38ch] text-xs text-muted-foreground">
                      {meta.description}
                    </p>
                  </td>
                  {data.editableRoles.map((role) => (
                    <td className="px-3 py-3 text-center" key={role}>
                      <Checkbox
                        aria-label={`${ROLE_LABELS[role] ?? role}: ${meta.label}`}
                        checked={hasCapabilityIn(state, role, meta.capability)}
                        onCheckedChange={() => onToggle(role, meta.capability)}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          ))}
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          Super administrators always hold every capability; voters never hold
          any. Changes take effect within a minute.
        </p>
        <Button
          disabled={dirtyRoles.length === 0}
          loading={saving}
          onClick={() => setConfirmOpen(true)}
          variant="brand"
        >
          Save changes
        </Button>
      </div>

      <ConfirmationDialog
        confirmText="Save permissions"
        description={`This updates what ${dirtyRoles
          .map((role) => ROLE_LABELS[role] ?? role)
          .join(", ")} accounts can do, effective immediately.`}
        onConfirm={onSave}
        onOpenChange={setConfirmOpen}
        open={confirmOpen}
        title="Apply permission changes?"
      />
    </div>
  );
}

export default function PermissionsPage() {
  const { initialized, isSuperAdmin } = useAuthRole();
  const { data, isError, isLoading } = useGetPermissionsQuery(undefined, {
    skip: initialized && !isSuperAdmin,
  });

  if (initialized && !isSuperAdmin) {
    return (
      <EmptyState
        description="Only super administrators can manage permissions."
        icon={ShieldCheck}
        title="Not available"
      />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        description="Control what each role can do across the platform. Per-user grants add to these role permissions."
        title="Permissions"
      />
      {isLoading ? (
        <TableRowsSkeleton cols={5} />
      ) : isError || !data ? (
        <ErrorState message={isError ? undefined : "Could not load permissions."} />
      ) : (
        // Mounted only once the data exists so the local matrix state can be
        // derived directly from it (the DMS edit-form pattern).
        <Matrix data={data.data} />
      )}
    </div>
  );
}
