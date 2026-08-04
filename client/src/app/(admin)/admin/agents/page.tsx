"use client";

// Agent assignments: which agent observes which election, optionally for a
// specific candidate (results-room and process agents). Assignments apply
// directly (audited); removal is super-admin only.
import { type ColumnDef, type Row } from "@tanstack/react-table";
import { Eye, Lock, Pencil, Plus, Trash2, UserCheck } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";

import type { AgentAssignment } from "@/types/api";

import { EntityAvatar } from "@/components/console/entity-avatar";
import { PhotoInput } from "@/components/console/photo-input";
import { RowActionsMenu } from "@/components/console/row-actions";
import { TableDate } from "@/components/console/table-date";
import { FilterField, TableToolbar } from "@/components/console/table-toolbar";
import { Badge } from "@/components/ui/badge";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { DataTable, useDataTable } from "@/components/ui/data-table";
import { Field } from "@/components/ui/field";
import { Input, Select as NativeSelect } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { EmptyState, PageHeader } from "@/components/ui/states";
import { RowCard } from "@/components/ui/table-bits";
import { clearAllFiltersPatch } from "@/components/ui/table-empty-logic";
import { useAuthRole } from "@/hooks/use-auth-role";
import { type TableFiltersSpec } from "@/hooks/table-query-state-logic";
import { useTableQueryState } from "@/hooks/use-table-query-state";
import { useListCandidatesQuery, useListElectionsQuery } from "@/redux/admin-api";
import {
  useAssignAgentMutation,
  useCreateStaffUserMutation,
  useListAgentsQuery,
  useListStaffUsersQuery,
  useLockUserMutation,
  useRemoveAgentMutation,
} from "@/redux/governance-api";
import { getApiErrorMessage } from "@/utils/extract-api-error";

interface AgentFilters extends Record<string, string | undefined> {
  electionId?: string;
  from?: string;
  search?: string;
  to?: string;
}

const FILTERS_SPEC: TableFiltersSpec<AgentFilters> = {
  electionId: { kind: "string" },
  from: { kind: "string" },
  search: { kind: "string" },
  to: { kind: "string" },
};

/** Create the agent's login account (agents never appear in the Users tab). */
function NewAgentModal({ onClose, open }: { onClose: () => void; open: boolean }) {
  const [create, { isLoading: creating }] = useCreateStaffUserMutation();
  const [tempPassword, setTempPassword] = useState<null | string>(null);
  const [photo, setPhoto] = useState<File | null>(null);

  const close = () => {
    setTempPassword(null);
    setPhoto(null);
    onClose();
  };

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const body = new FormData();
    body.append("firstName", String(f.get("firstName")));
    body.append("lastName", String(f.get("lastName")));
    body.append("email", String(f.get("email")));
    if (f.get("phone")) body.append("phone", String(f.get("phone")));
    body.append("role", "AGENT");
    if (photo) body.append("image", photo);
    try {
      const res = (await create(body).unwrap()) as {
        data?: { temporaryPassword?: string };
      };
      toast.success("Agent account created");
      setTempPassword(res.data?.temporaryPassword ?? null);
    } catch (error) {
      toast.error(getApiErrorMessage(error));
    }
  };

  return (
    <Modal
      description={
        tempPassword
          ? undefined
          : "The system generates a temporary password and emails it to them; they set their own on first sign-in."
      }
      onClose={close}
      open={open}
      title={tempPassword ? "Agent account created" : "New agent"}
    >
      {tempPassword ? (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Share this temporary password with the agent - it is shown only
            once (they also receive it by email).
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 rounded-lg border border-border bg-muted/40 px-3 py-2 text-center font-mono text-lg tracking-wider">
              {tempPassword}
            </code>
            <Button
              onClick={async () => {
                await navigator.clipboard.writeText(tempPassword);
                toast.success("Copied");
              }}
              size="sm"
              type="button"
              variant="outline"
            >
              Copy
            </Button>
          </div>
          <Button className="w-full" onClick={close} variant="brand">
            Done
          </Button>
        </div>
      ) : (
        <form className="space-y-4" onSubmit={onSubmit}>
          <div className="grid grid-cols-2 gap-3">
            <Field label="First name">
              <Input name="firstName" placeholder="e.g. Kojo" required />
            </Field>
            <Field label="Last name">
              <Input name="lastName" placeholder="e.g. Asare" required />
            </Field>
          </div>
          <Field label="Email">
            <Input name="email" placeholder="e.g. agent@org.com" required type="email" />
          </Field>
          <Field label="Phone">
            <Input name="phone" placeholder="e.g. +233 24 000 0000 (optional)" type="tel" />
          </Field>
          <PhotoInput file={photo} onChange={setPhoto} />
          <Button className="w-full" loading={creating} type="submit" variant="brand">
            Create agent
          </Button>
        </form>
      )}
    </Modal>
  );
}

function AssignAgentModal({ onClose, open }: { onClose: () => void; open: boolean }) {
  const [electionId, setElectionId] = useState("");
  const [assign, { isLoading: assigning }] = useAssignAgentMutation();
  const { data: agents } = useListStaffUsersQuery(
    { limit: 100, role: "AGENT" },
    { skip: !open },
  );
  const { data: elections } = useListElectionsQuery({ limit: 100 }, { skip: !open });
  const { data: candidates } = useListCandidatesQuery(
    { electionId, limit: 100 },
    { skip: !electionId },
  );

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    try {
      await assign({
        candidateId: String(f.get("candidateId") ?? "") || undefined,
        electionId: String(f.get("electionId")),
        userId: String(f.get("userId")),
      }).unwrap();
      toast.success("Agent assigned");
      onClose();
    } catch (error) {
      toast.error(getApiErrorMessage(error));
    }
  };

  return (
    <Modal
      description="The agent sees this election on their dashboard; tie them to a candidate to represent them specifically."
      onClose={onClose}
      open={open}
      title="Assign agent"
    >
      <form className="space-y-4" onSubmit={onSubmit}>
        <Field label="Agent">
          <NativeSelect name="userId" required>
            <option value="">Select agent…</option>
            {agents?.data.map((agent) => (
              <option key={agent.id} value={agent.id}>
                {agent.firstName} {agent.lastName}
                {agent.email ? ` (${agent.email})` : ""}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Election">
          <NativeSelect
            name="electionId"
            onChange={(e) => setElectionId(e.target.value)}
            required
            value={electionId}
          >
            <option value="">Select election…</option>
            {elections?.data.map((election) => (
              <option key={election.id} value={election.id}>
                {election.name}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field hint="Optional - leave empty for a general observer." label="Candidate">
          <NativeSelect disabled={!electionId} name="candidateId">
            <option value="">General observer</option>
            {candidates?.data.map((candidate) => (
              <option key={candidate.id} value={candidate.id}>
                {candidate.name}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Button className="w-full" loading={assigning} type="submit" variant="brand">
          Assign agent
        </Button>
      </form>
    </Modal>
  );
}

export default function AgentsPage() {
  const { isAdmin, isSuperAdmin } = useAuthRole();
  const [assignOpen, setAssignOpen] = useState(false);
  const [newAgentOpen, setNewAgentOpen] = useState(false);
  const [removing, setRemoving] = useState<AgentAssignment | null>(null);
  const [locking, setLocking] = useState<AgentAssignment | null>(null);
  const [removeAgent] = useRemoveAgentMutation();
  const [lockUser] = useLockUserMutation();
  const { data: elections } = useListElectionsQuery({ limit: 100 });

  const {
    filters,
    handleFiltersChange,
    handlePageChange,
    handlePageSizeChange,
    page,
    pageSize,
    queryParams,
  } = useTableQueryState<AgentFilters>({ spec: FILTERS_SPEC });

  const { data, isFetching, isLoading } = useListAgentsQuery(queryParams);
  const rows = data?.data ?? [];
  const totalCount = data?.meta.total ?? 0;

  const columns: ColumnDef<AgentAssignment>[] = [
    {
      cell: ({ row }) => (
        <div className="flex min-w-0 items-center gap-2.5">
          <EntityAvatar
            name={`${row.original.user.firstName} ${row.original.user.lastName}`}
            url={(row.original.user as { profilePicture?: null | string }).profilePicture}
          />
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">
              {row.original.user.firstName} {row.original.user.lastName}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {row.original.user.email ?? "—"}
            </p>
          </div>
        </div>
      ),
      header: "Agent",
      id: "agent",
    },
    {
      cell: ({ row }) => (
        <span className="text-sm">{row.original.election.name}</span>
      ),
      header: "Election",
      id: "election",
    },
    {
      cell: ({ row }) =>
        row.original.candidate ? (
          <Badge variant="outline">{row.original.candidate.name}</Badge>
        ) : (
          <span className="text-xs text-muted-foreground">General observer</span>
        ),
      header: "Represents",
      id: "candidate",
    },
    {
      accessorKey: "createdAt",
      cell: ({ row }) => (
<TableDate value={row.original.createdAt} />
      ),
      header: "Assigned",
    },
    {
      cell: ({ row }) => (
        <RowActionsMenu label="Assignment actions">
          <DropdownMenuItem asChild>
            <Link href={`/admin/users/${row.original.user.id}`}>
              <Eye className="size-4" /> View profile
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href={`/admin/users/${row.original.user.id}?edit=1`}>
              <Pencil className="size-4" /> Edit
            </Link>
          </DropdownMenuItem>
          {isAdmin && (
            <DropdownMenuItem onClick={() => setLocking(row.original)}>
              <Lock className="size-4" /> Lock account
            </DropdownMenuItem>
          )}
          {isSuperAdmin && (
            <DropdownMenuItem
              onClick={() => setRemoving(row.original)}
              variant="destructive"
            >
              <Trash2 className="size-4" /> Remove
            </DropdownMenuItem>
          )}
        </RowActionsMenu>
      ),
      header: "Actions",
      id: "actions",
    },
  ];

  const table = useDataTable({
    columns,
    data: rows,
    enableRowSelection: false,
    getRowId: (row) => row.id,
    pageSize,
    totalCount,
  });

  return (
    <div className="space-y-6">
      <PageHeader
        description="Candidate representatives and process observers, and the elections they watch."
        title="Agents"
      />

      <DataTable
        emptyState={
          <EmptyState
            description="Assign agents so candidates have eyes on the process and the results room."
            icon={UserCheck}
            title="No assignments yet"
          />
        }
        entityLabel="assignments"
        filters={filters}
        loading={isLoading || isFetching}
        onClearFilters={() => handleFiltersChange(clearAllFiltersPatch(filters))}
        onPageChange={handlePageChange}
        onPageSizeChange={handlePageSizeChange}
        page={page}
        pageSize={pageSize}
        renderRowCard={(row: Row<AgentAssignment>) => (
          <RowCard
            action={
              isSuperAdmin ? (
                <Button
                  aria-label="Remove assignment"
                  onClick={() => setRemoving(row.original)}
                  size="icon-sm"
                  variant="ghost"
                >
                  <Trash2 className="size-4 text-destructive" />
                </Button>
              ) : undefined
            }
            key={row.id}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="min-w-0 truncate text-sm font-medium">
                {row.original.user.firstName} {row.original.user.lastName}
              </span>
            </div>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              {row.original.election.name}
              {row.original.candidate ? ` · for ${row.original.candidate.name}` : ""}
            </p>
          </RowCard>
        )}
        table={table}
        toolbar={
          <TableToolbar
            actions={
              <>
                <Button onClick={() => setNewAgentOpen(true)} variant="outline">
                  <Plus className="size-4" /> New agent
                </Button>
                <Button onClick={() => setAssignOpen(true)} variant="brand">
                  <Plus className="size-4" /> Assign agent
                </Button>
              </>
            }
            filters={filters}
            onClear={() => handleFiltersChange(clearAllFiltersPatch(filters))}
            onSearchChange={(value) => handleFiltersChange({ search: value || undefined })}
            search={filters.search ?? ""}
            searchPlaceholder="Search agent, candidate, or election…"
          >
            <FilterField caption="Election">
              <NativeSelect
                className="w-full lg:w-48"
                onChange={(e) =>
                  handleFiltersChange({
                    electionId: e.target.value === "all" ? undefined : e.target.value,
                  })
                }
                value={filters.electionId ?? "all"}
              >
                <option value="all">All elections</option>
                {elections?.data.map((election) => (
                  <option key={election.id} value={election.id}>
                    {election.name}
                  </option>
                ))}
              </NativeSelect>
            </FilterField>
            <FilterField caption="From date">
              <Input
                aria-label="From date"
                className="w-full lg:w-38"
                onChange={(e) => handleFiltersChange({ from: e.target.value || undefined })}
                type="date"
                value={filters.from ?? ""}
              />
            </FilterField>
            <FilterField caption="To date">
              <Input
                aria-label="To date"
                className="w-full lg:w-38"
                onChange={(e) => handleFiltersChange({ to: e.target.value || undefined })}
                type="date"
                value={filters.to ?? ""}
              />
            </FilterField>
          </TableToolbar>
        }
        totalCount={totalCount}
      />

      <AssignAgentModal onClose={() => setAssignOpen(false)} open={assignOpen} />
      <NewAgentModal onClose={() => setNewAgentOpen(false)} open={newAgentOpen} />
      <ConfirmationDialog
        confirmText="Lock account"
        description={`${locking?.user.firstName ?? ""} ${locking?.user.lastName ?? ""} will be signed out everywhere and unable to sign in until a super administrator unlocks the account.`}
        isDestructive
        onConfirm={async () => {
          if (!locking) return;
          setLocking(null);
          try {
            await lockUser(locking.user.id).unwrap();
            toast.success("Account locked");
          } catch (error) {
            toast.error(getApiErrorMessage(error));
          }
        }}
        onOpenChange={(open) => !open && setLocking(null)}
        open={locking !== null}
        title="Lock this account?"
      />
      <ConfirmationDialog
        confirmText="Remove assignment"
        description={`${removing?.user.firstName ?? ""} ${removing?.user.lastName ?? ""} will no longer observe "${removing?.election.name ?? ""}".`}
        isDestructive
        onConfirm={async () => {
          if (!removing) return;
          setRemoving(null);
          try {
            await removeAgent(removing.id).unwrap();
            toast.success("Assignment removed");
          } catch (error) {
            toast.error(getApiErrorMessage(error));
          }
        }}
        onOpenChange={(open) => !open && setRemoving(null)}
        open={removing !== null}
        title="Remove this assignment?"
      />
    </div>
  );
}
