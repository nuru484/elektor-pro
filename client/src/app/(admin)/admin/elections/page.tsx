"use client";

import { type ColumnDef, type Row } from "@tanstack/react-table";
import { Plus, Vote } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";

import type { Election, ElectionStatus } from "@/types/api";

import { TableToolbar } from "@/components/console/table-toolbar";
import { Button } from "@/components/ui/button";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { DataTable, useDataTable } from "@/components/ui/data-table";
import { Field } from "@/components/ui/field";
import { Input, Select as NativeSelect } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Modal } from "@/components/ui/modal";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState, PageHeader } from "@/components/ui/states";
import { RowCard } from "@/components/ui/table-bits";
import { clearAllFiltersPatch } from "@/components/ui/table-empty-logic";
import { type TableFiltersSpec } from "@/hooks/table-query-state-logic";
import { useTableQueryState } from "@/hooks/use-table-query-state";
import {
  useCreateElectionMutation,
  useListElectionsQuery,
  useSetElectionStatusMutation,
} from "@/redux/admin-api";
import { getApiErrorMessage } from "@/utils/extract-api-error";

const STATUSES: ElectionStatus[] = [
  "DRAFT",
  "SCHEDULED",
  "IN_PROGRESS",
  "PAUSED",
  "ENDED",
  "CANCELLED",
  "ARCHIVED",
];

interface ElectionFilters extends Record<string, string | undefined> {
  search?: string;
  status?: string;
}

const FILTERS_SPEC: TableFiltersSpec<ElectionFilters> = {
  search: { kind: "string" },
  status: { kind: "enum", values: STATUSES },
};

/** Status select that confirms before applying the change. */
function StatusCell({ election }: { election: Election }) {
  const [setElectionStatus] = useSetElectionStatusMutation();
  const [pendingStatus, setPendingStatus] = useState<ElectionStatus | null>(null);

  const apply = async () => {
    if (!pendingStatus) return;
    setPendingStatus(null);
    try {
      const res = await setElectionStatus({ id: election.id, status: pendingStatus }).unwrap();
      toast.success(
        (res as { pending?: boolean }).pending
          ? "Change submitted for approval"
          : "Status updated",
      );
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Could not update status"));
    }
  };

  return (
    <>
      <Select
        onValueChange={(value) => setPendingStatus(value as ElectionStatus)}
        value={election.status}
      >
        <SelectTrigger
          aria-label={`Change status of ${election.name}`}
          className="h-8 w-auto text-xs"
          size="sm"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {STATUSES.map((status) => (
            <SelectItem key={status} value={status}>
              {status.replace("_", " ")}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <ConfirmationDialog
        confirmText="Change status"
        description={`"${election.name}" will move from ${election.status.replace("_", " ")} to ${pendingStatus?.replace("_", " ") ?? ""}. This affects what voters and agents can do right now.`}
        onConfirm={apply}
        onOpenChange={(open) => !open && setPendingStatus(null)}
        open={pendingStatus !== null}
        title="Change election status?"
      />
    </>
  );
}

const COLUMNS: ColumnDef<Election>[] = [
  {
    accessorKey: "name",
    cell: ({ row }) => (
      <div className="min-w-0">
        <Link className="font-medium hover:text-brand" href={`/results/${row.original.slug}`}>
          {row.original.name}
        </Link>
        <p className="text-xs text-muted-foreground">
          {row.original._count?.portfolios ?? 0} portfolios ·{" "}
          {row.original._count?.candidates ?? 0} candidates
        </p>
      </div>
    ),
    header: "Election",
  },
  {
    cell: ({ row }) => (
      <span className="text-xs whitespace-nowrap text-muted-foreground">
        {new Date(row.original.startDate).toLocaleDateString()} –{" "}
        {new Date(row.original.endDate).toLocaleDateString()}
      </span>
    ),
    header: "Window",
    id: "window",
  },
  {
    accessorKey: "status",
    cell: ({ row }) => <StatusBadge status={row.original.status} />,
    header: "Status",
  },
  {
    cell: ({ row }) => <StatusCell election={row.original} />,
    header: "Change status",
    id: "actions",
  },
];

function CreateElectionModal({ onClose, open }: { onClose: () => void; open: boolean }) {
  const [createElection, { isLoading: creating }] = useCreateElectionMutation();

  const onCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    try {
      const res = await createElection({
        description: f.get("description") || undefined,
        endDate: f.get("endDate"),
        eligibilityMode: f.get("eligibilityMode"),
        name: f.get("name"),
        resultsPolicy: f.get("resultsPolicy"),
        startDate: f.get("startDate"),
      }).unwrap();
      onClose();
      toast.success(
        (res as { pending?: boolean }).pending
          ? "Election submitted for super-admin approval"
          : "Election created",
      );
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Could not create election"));
    }
  };

  return (
    <Modal
      description="Define the basics. You can add portfolios and candidates next."
      onClose={onClose}
      open={open}
      title="New election"
    >
      <form className="space-y-4" onSubmit={onCreate}>
        <Field label="Election name">
          <Input name="name" placeholder="e.g. General Election 2026" required />
        </Field>
        <Field label="Description">
          <Input name="description" placeholder="Optional summary shown to voters" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Start date">
            <Input name="startDate" required type="datetime-local" />
          </Field>
          <Field label="End date">
            <Input name="endDate" required type="datetime-local" />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Who can vote">
            <NativeSelect defaultValue="ALL_VOTERS" name="eligibilityMode">
              <option value="ALL_VOTERS">All registered voters</option>
              <option value="ROLL">Assigned roll only</option>
            </NativeSelect>
          </Field>
          <Field label="Results visibility">
            <NativeSelect defaultValue="ON_CLOSE" name="resultsPolicy">
              <option value="ON_CLOSE">When election ends</option>
              <option value="LIVE">Live</option>
              <option value="MANUAL">Manual publish</option>
            </NativeSelect>
          </Field>
        </div>
        <Button className="w-full" loading={creating} type="submit" variant="brand">
          Create election
        </Button>
      </form>
    </Modal>
  );
}

export default function ElectionsPage() {
  const [createOpen, setCreateOpen] = useState(false);
  const {
    filters,
    handleFiltersChange,
    handlePageChange,
    handlePageSizeChange,
    page,
    pageSize,
    queryParams,
  } = useTableQueryState<ElectionFilters>({ spec: FILTERS_SPEC });

  const { data, isFetching, isLoading } = useListElectionsQuery(queryParams);

  const rows = data?.data ?? [];
  const totalCount = data?.meta.total ?? 0;

  const table = useDataTable({
    columns: COLUMNS,
    data: rows,
    enableRowSelection: false,
    getRowId: (row) => row.id,
    pageSize,
    totalCount,
  });

  return (
    <div className="space-y-6">
      <PageHeader
        action={
          <Button onClick={() => setCreateOpen(true)} variant="brand">
            <Plus className="size-4" /> New election
          </Button>
        }
        description="Create and manage elections, then open them for voting."
        title="Elections"
      />

      <DataTable
        emptyState={
          <EmptyState
            action={
              <Button onClick={() => setCreateOpen(true)} variant="brand">
                <Plus className="size-4" /> New election
              </Button>
            }
            description="Create your first election to get started."
            icon={Vote}
            title="No elections yet"
          />
        }
        entityLabel="elections"
        filters={filters}
        loading={isLoading || isFetching}
        onClearFilters={() => handleFiltersChange(clearAllFiltersPatch(filters))}
        onPageChange={handlePageChange}
        onPageSizeChange={handlePageSizeChange}
        page={page}
        pageSize={pageSize}
        renderRowCard={(row: Row<Election>) => (
          <RowCard key={row.id}>
            <div className="flex items-center justify-between gap-2">
              <Link
                className="min-w-0 truncate text-sm font-medium"
                href={`/results/${row.original.slug}`}
              >
                {row.original.name}
              </Link>
              <StatusBadge status={row.original.status} />
            </div>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              {row.original._count?.portfolios ?? 0} portfolios ·{" "}
              {row.original._count?.candidates ?? 0} candidates ·{" "}
              {new Date(row.original.startDate).toLocaleDateString()}
            </p>
          </RowCard>
        )}
        table={table}
        toolbar={
          <TableToolbar
            filters={filters}
            onClear={() => handleFiltersChange(clearAllFiltersPatch(filters))}
            onSearchChange={(value) => handleFiltersChange({ search: value || undefined })}
            search={filters.search ?? ""}
            searchPlaceholder="Search elections…"
          >
            <Select
              onValueChange={(value) =>
                handleFiltersChange({ status: value === "all" ? undefined : value })
              }
              value={filters.status ?? "all"}
            >
              <SelectTrigger className="w-full sm:w-44">
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {STATUSES.map((status) => (
                  <SelectItem key={status} value={status}>
                    {status.replace("_", " ")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </TableToolbar>
        }
        totalCount={totalCount}
      />

      <CreateElectionModal onClose={() => setCreateOpen(false)} open={createOpen} />
    </div>
  );
}
