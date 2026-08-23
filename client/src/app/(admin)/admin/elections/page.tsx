"use client";

import { type ColumnDef, type Row } from "@tanstack/react-table";
import { Plus, Vote } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import type { Election, ElectionStatus, EligibilityMode } from "@/types/api";

import { ELIGIBILITY_MODE_HINTS } from "@/components/elections/election-lifecycle";
import { GroupPicker } from "@/components/elections/group-picker";
import { ElectionStatusControl } from "@/components/elections/status-control";
import { FilterField, TableToolbar } from "@/components/console/table-toolbar";
import { Button } from "@/components/ui/button";
import { DataTable, useDataTable } from "@/components/ui/data-table";
import { Field } from "@/components/ui/field";
import { Input, Select as NativeSelect } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState, PageHeader } from "@/components/ui/states";
import { RowCard } from "@/components/ui/table-bits";
import { clearAllFiltersPatch } from "@/components/ui/table-empty-logic";
import { type TableFiltersSpec } from "@/hooks/table-query-state-logic";
import { useTableQueryState } from "@/hooks/use-table-query-state";
import { useCreateElectionMutation, useListElectionsQuery } from "@/redux/admin-api";
import { getApiErrorMessage } from "@/utils/extract-api-error";
import { formatDate } from "@/utils/format-date";

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
  from?: string;
  search?: string;
  status?: string;
  to?: string;
}

const FILTERS_SPEC: TableFiltersSpec<ElectionFilters> = {
  from: { kind: "string" },
  search: { kind: "string" },
  status: { kind: "enum", values: STATUSES },
  to: { kind: "string" },
};

const COLUMNS: ColumnDef<Election>[] = [
  {
    accessorKey: "name",
    cell: ({ row }) => (
      <div className="min-w-0">
        <Link
          className="block max-w-[90%] truncate font-medium hover:text-brand"
          href={`/admin/elections/${row.original.id}`}
          title={row.original.name}
        >
          {row.original.name}
        </Link>
        <p className="text-xs text-muted-foreground">
          {row.original._count?.portfolios ?? 0} portfolios ·{" "}
          {row.original._count?.candidates ?? 0} candidates
        </p>
      </div>
    ),
    header: "Election",
    meta: { stretch: true },
  },
  {
    cell: ({ row }) => (
      <span className="text-xs whitespace-nowrap text-muted-foreground">
        {formatDate(row.original.startDate)} –{" "}
        {formatDate(row.original.endDate)}
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
    cell: ({ row }) => <ElectionStatusControl election={row.original} />,
    header: "Change status",
    id: "actions",
  },
];

function CreateElectionModal({ onClose, open }: { onClose: () => void; open: boolean }) {
  const [createElection, { isLoading: creating }] = useCreateElectionMutation();
  const [mode, setMode] = useState<EligibilityMode>("ALL_VOTERS");
  const [groupIds, setGroupIds] = useState<string[]>([]);
  const [groupError, setGroupError] = useState<string | undefined>();

  const onCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    if (mode === "GROUPS" && groupIds.length === 0) {
      setGroupError("Select at least one group");
      return;
    }
    setGroupError(undefined);
    try {
      const res = await createElection({
        description: f.get("description") || undefined,
        endDate: f.get("endDate"),
        eligibilityMode: mode,
        ...(mode === "GROUPS" ? { groupIds } : {}),
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
      description="Define the basics; portfolios, candidates, and the roll are managed inside the election."
      onClose={onClose}
      open={open}
      title="New election"
    >
      <form className="space-y-4" noValidate onSubmit={onCreate}>
        <Field label="Election name">
          <Input name="name" placeholder="e.g. General Election 2026" required />
        </Field>
        <Field label="Description">
          <Input name="description" placeholder="Optional summary shown to voters" />
        </Field>
        <div className="grid grid-cols-1 gap-3 min-[360px]:grid-cols-2">
          <Field label="Start date">
            <Input name="startDate" required type="datetime-local" />
          </Field>
          <Field label="End date">
            <Input name="endDate" required type="datetime-local" />
          </Field>
        </div>
        <div className="grid grid-cols-1 gap-3 min-[360px]:grid-cols-2">
          <Field hint={ELIGIBILITY_MODE_HINTS[mode]} label="Who can vote">
            <NativeSelect
              onChange={(e) => {
                setMode(e.target.value as EligibilityMode);
              }}
              value={mode}
            >
              <option value="ALL_VOTERS">All registered voters</option>
              <option value="GROUPS">Specific groups</option>
              <option value="ROLL">Managed roll</option>
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
        {mode === "GROUPS" && (
          <GroupPicker error={groupError} onChange={setGroupIds} value={groupIds} />
        )}
        <Button className="w-full" loading={creating} type="submit" variant="brand">
          Create election
        </Button>
      </form>
    </Modal>
  );
}

export default function ElectionsPage() {
  const router = useRouter();
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
        onRowOpen={(row: Row<Election>) => {
          router.push(`/admin/elections/${row.original.id}`);
        }}
        page={page}
        pageSize={pageSize}
        renderRowCard={(row: Row<Election>) => (
          <RowCard
            key={row.id}
            onOpen={() => {
              router.push(`/admin/elections/${row.original.id}`);
            }}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="min-w-0 truncate text-sm font-medium">
                {row.original.name}
              </span>
              <StatusBadge status={row.original.status} />
            </div>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              {row.original._count?.portfolios ?? 0} portfolios ·{" "}
              {row.original._count?.candidates ?? 0} candidates ·{" "}
              {formatDate(row.original.startDate)}
            </p>
          </RowCard>
        )}
        table={table}
        toolbar={
          <TableToolbar
            actions={
              <Button onClick={() => setCreateOpen(true)} variant="brand">
                <Plus className="size-4" /> New election
              </Button>
            }
            filters={filters}
            onClear={() => handleFiltersChange(clearAllFiltersPatch(filters))}
            onSearchChange={(value) => handleFiltersChange({ search: value || undefined })}
            search={filters.search ?? ""}
            searchPlaceholder="Search elections…"
          >
            <FilterField caption="Status">
              <NativeSelect
                className="w-full lg:w-44"
                onChange={(e) =>
                  handleFiltersChange({
                    status: e.target.value === "all" ? undefined : e.target.value,
                  })
                }
                title="Filter by election status"
                value={filters.status ?? "all"}
              >
                <option value="all">All statuses</option>
                {STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {status.replace("_", " ")}
                  </option>
                ))}
              </NativeSelect>
            </FilterField>
            <FilterField caption="Starts from">
              <Input
                className="w-full lg:w-40"
                onChange={(e) =>
                  handleFiltersChange({ from: e.target.value || undefined })
                }
                title="Elections starting on or after this date"
                type="date"
                value={filters.from ?? ""}
              />
            </FilterField>
            <FilterField caption="Starts to">
              <Input
                className="w-full lg:w-40"
                onChange={(e) =>
                  handleFiltersChange({ to: e.target.value || undefined })
                }
                title="Elections starting on or before this date"
                type="date"
                value={filters.to ?? ""}
              />
            </FilterField>
          </TableToolbar>
        }
        rowOpenHint="Open this election's workspace"
        totalCount={totalCount}
      />

      <CreateElectionModal
        key={createOpen ? "open" : "closed"}
        onClose={() => setCreateOpen(false)}
        open={createOpen}
      />
    </div>
  );
}
