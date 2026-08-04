"use client";

// Agent assignments: which agent observes which election, optionally for a
// specific candidate (results-room and process agents). Assignments apply
// directly (audited); removal is super-admin only.
import { type ColumnDef, type Row } from "@tanstack/react-table";
import { Plus, Trash2, UserCheck } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import type { AgentAssignment } from "@/types/api";

import { FilterField, TableToolbar } from "@/components/console/table-toolbar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { DataTable, useDataTable } from "@/components/ui/data-table";
import { Field } from "@/components/ui/field";
import { Input, Select as NativeSelect } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState, PageHeader } from "@/components/ui/states";
import { RowCard } from "@/components/ui/table-bits";
import { clearAllFiltersPatch } from "@/components/ui/table-empty-logic";
import { useAuthRole } from "@/hooks/use-auth-role";
import { type TableFiltersSpec } from "@/hooks/table-query-state-logic";
import { useTableQueryState } from "@/hooks/use-table-query-state";
import { useListCandidatesQuery, useListElectionsQuery } from "@/redux/admin-api";
import {
  useAssignAgentMutation,
  useListAgentsQuery,
  useListStaffUsersQuery,
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
  const { isSuperAdmin } = useAuthRole();
  const [assignOpen, setAssignOpen] = useState(false);
  const [removing, setRemoving] = useState<AgentAssignment | null>(null);
  const [removeAgent] = useRemoveAgentMutation();
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
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">
            {row.original.user.firstName} {row.original.user.lastName}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {row.original.user.email ?? "—"}
          </p>
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
        <time className="text-xs whitespace-nowrap tabular-nums text-muted-foreground">
          {new Date(row.original.createdAt).toLocaleDateString()}
        </time>
      ),
      header: "Assigned",
    },
    {
      cell: ({ row }) =>
        isSuperAdmin ? (
          <div className="flex justify-end">
            <Button
              aria-label="Remove assignment"
              onClick={() => setRemoving(row.original)}
              size="icon-sm"
              variant="ghost"
            >
              <Trash2 className="size-4 text-destructive" />
            </Button>
          </div>
        ) : null,
      header: "",
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
              <Button onClick={() => setAssignOpen(true)} variant="brand">
                <Plus className="size-4" /> Assign agent
              </Button>
            }
            filters={filters}
            onClear={() => handleFiltersChange(clearAllFiltersPatch(filters))}
            onSearchChange={(value) => handleFiltersChange({ search: value || undefined })}
            search={filters.search ?? ""}
            searchPlaceholder="Search agent, candidate, or election…"
          >
            <FilterField caption="Election">
              <Select
                onValueChange={(value) =>
                  handleFiltersChange({ electionId: value === "all" ? undefined : value })
                }
                value={filters.electionId ?? "all"}
              >
                <SelectTrigger className="w-full lg:w-48">
                  <SelectValue placeholder="All elections" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All elections</SelectItem>
                  {elections?.data.map((election) => (
                    <SelectItem key={election.id} value={election.id}>
                      {election.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
