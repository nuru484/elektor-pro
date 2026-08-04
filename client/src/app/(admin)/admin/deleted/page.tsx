"use client";

// The deleted-records manager (super-admin only): everything soft-deleted
// across the platform, grouped by resource - restore a row back to life, or
// purge it permanently with a type-to-confirm gate.
import { type ColumnDef, type Row } from "@tanstack/react-table";
import { ArchiveRestore, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import type { DeletedRow } from "@/types/api";

import { RowActionsMenu } from "@/components/console/row-actions";
import { FilterField, TableToolbar } from "@/components/console/table-toolbar";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { DataTable, useDataTable } from "@/components/ui/data-table";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState, ErrorState, PageHeader } from "@/components/ui/states";
import { RowCard } from "@/components/ui/table-bits";
import { clearAllFiltersPatch } from "@/components/ui/table-empty-logic";
import { useAuthRole } from "@/hooks/use-auth-role";
import { type TableFiltersSpec } from "@/hooks/table-query-state-logic";
import { useTableQueryState } from "@/hooks/use-table-query-state";
import {
  useGetDeletedSummaryQuery,
  useListDeletedRecordsQuery,
  usePurgeDeletedRecordMutation,
  useRestoreDeletedRecordMutation,
} from "@/redux/admin-api";
import { getApiErrorMessage } from "@/utils/extract-api-error";

const RESOURCES = [
  "voters",
  "users",
  "elections",
  "portfolios",
  "candidates",
  "agent-assignments",
  "groups",
  "group-categories",
] as const;

const RESOURCE_LABELS: Record<string, string> = {
  "agent-assignments": "Agent assignments",
  candidates: "Candidates",
  elections: "Elections",
  "group-categories": "Group categories",
  groups: "Groups",
  portfolios: "Portfolios",
  users: "Users",
  voters: "Voters",
};

interface DeletedFilters extends Record<string, string | undefined> {
  from?: string;
  resource?: string;
  to?: string;
}

const FILTERS_SPEC: TableFiltersSpec<DeletedFilters> = {
  from: { kind: "string" },
  resource: { kind: "enum", values: RESOURCES },
  to: { kind: "string" },
};

export default function DeletedRecordsPage() {
  const { initialized, isSuperAdmin } = useAuthRole();
  const [confirmAction, setConfirmAction] = useState<
    null | { id: string; kind: "purge" | "restore"; label: string }
  >(null);

  const {
    filters,
    handleFiltersChange,
    handlePageChange,
    handlePageSizeChange,
    page,
    pageSize,
    queryParams,
  } = useTableQueryState<DeletedFilters>({ spec: FILTERS_SPEC });

  const resource = filters.resource ?? "voters";
  const notAllowed = initialized && !isSuperAdmin;

  const { data: summary } = useGetDeletedSummaryQuery(undefined, { skip: notAllowed });
  const { data, isError, isFetching, isLoading } = useListDeletedRecordsQuery(
    { ...queryParams, resource },
    { skip: notAllowed },
  );

  const [restore] = useRestoreDeletedRecordMutation();
  const [purge] = usePurgeDeletedRecordMutation();

  const rows = data?.data ?? [];
  const totalCount = data?.meta.total ?? 0;
  const countFor = (key: string): number =>
    summary?.data.find((entry) => entry.resource === key)?.count ?? 0;

  const columns: ColumnDef<DeletedRow>[] = [
    {
      accessorKey: "label",
      cell: ({ row }) => (
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{row.original.label || "—"}</p>
          {row.original.meta && (
            <p className="truncate font-mono text-xs text-muted-foreground">
              {row.original.meta}
            </p>
          )}
        </div>
      ),
      header: RESOURCE_LABELS[resource] ?? "Record",
    },
    {
      accessorKey: "deletedAt",
      cell: ({ row }) => (
        <time className="text-xs whitespace-nowrap tabular-nums text-muted-foreground">
          {new Date(row.original.deletedAt).toLocaleString()}
        </time>
      ),
      header: "Deleted",
    },
    {
      cell: ({ row }) => (
        <RowActionsMenu label="Record actions">
          <DropdownMenuItem
            onClick={() =>
              setConfirmAction({
                id: row.original.id,
                kind: "restore",
                label: row.original.label,
              })
            }
          >
            <ArchiveRestore className="size-4" /> Restore
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() =>
              setConfirmAction({
                id: row.original.id,
                kind: "purge",
                label: row.original.label,
              })
            }
            variant="destructive"
          >
            <Trash2 className="size-4" /> Purge
          </DropdownMenuItem>
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

  if (notAllowed) {
    return (
      <EmptyState
        description="Only super administrators can manage deleted records."
        icon={Trash2}
        title="Not available"
      />
    );
  }

  const runConfirmed = async () => {
    if (!confirmAction) return;
    const { id, kind } = confirmAction;
    setConfirmAction(null);
    try {
      if (kind === "restore") {
        await restore({ id, resource }).unwrap();
        toast.success("Record restored");
      } else {
        await purge({ id, resource }).unwrap();
        toast.success("Record permanently deleted");
      }
    } catch (error) {
      toast.error(getApiErrorMessage(error));
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        description="Soft-deleted records across the platform. Restore brings a record back exactly as it was; purge removes it forever."
        title="Deleted records"
      />

      {isError ? (
        <ErrorState />
      ) : (
        <DataTable
          emptyState={
            <EmptyState
              description={`No deleted ${RESOURCE_LABELS[resource]?.toLowerCase() ?? "records"} right now.`}
              icon={ArchiveRestore}
              title="Nothing here"
            />
          }
          entityLabel="deleted records"
          filters={filters}
          loading={isLoading || isFetching}
          onClearFilters={() => handleFiltersChange(clearAllFiltersPatch(filters))}
          onPageChange={handlePageChange}
          onPageSizeChange={handlePageSizeChange}
          page={page}
          pageSize={pageSize}
          renderRowCard={(row: Row<DeletedRow>) => (
            <RowCard
              action={
                <RowActionsMenu label="Record actions">
                  <DropdownMenuItem
                    onClick={() =>
                      setConfirmAction({
                        id: row.original.id,
                        kind: "restore",
                        label: row.original.label,
                      })
                    }
                  >
                    <ArchiveRestore className="size-4" /> Restore
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() =>
                      setConfirmAction({
                        id: row.original.id,
                        kind: "purge",
                        label: row.original.label,
                      })
                    }
                    variant="destructive"
                  >
                    <Trash2 className="size-4" /> Purge
                  </DropdownMenuItem>
                </RowActionsMenu>
              }
              key={row.id}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="min-w-0 truncate text-sm font-medium">
                  {row.original.label || "—"}
                </span>
                <time className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
                  {new Date(row.original.deletedAt).toLocaleDateString()}
                </time>
              </div>
              {row.original.meta && (
                <p className="mt-0.5 truncate font-mono text-xs text-muted-foreground">
                  {row.original.meta}
                </p>
              )}
            </RowCard>
          )}
          table={table}
          toolbar={
            <TableToolbar
              filters={filters}
              onClear={() => handleFiltersChange(clearAllFiltersPatch(filters))}
            >
              <FilterField caption="Resource">
                <Select
                  onValueChange={(value) => handleFiltersChange({ resource: value })}
                  value={resource}
                >
                  <SelectTrigger className="w-full lg:w-52">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {RESOURCES.map((key) => (
                      <SelectItem key={key} value={key}>
                        {RESOURCE_LABELS[key]} ({countFor(key)})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FilterField>
              <FilterField caption="From date">
                <Input
                  aria-label="From date"
                  className="w-full lg:w-38"
                  onChange={(e) =>
                    handleFiltersChange({ from: e.target.value || undefined })
                  }
                  type="date"
                  value={filters.from ?? ""}
                />
              </FilterField>
              <FilterField caption="To date">
                <Input
                  aria-label="To date"
                  className="w-full lg:w-38"
                  onChange={(e) =>
                    handleFiltersChange({ to: e.target.value || undefined })
                  }
                  type="date"
                  value={filters.to ?? ""}
                />
              </FilterField>
            </TableToolbar>
          }
          totalCount={totalCount}
        />
      )}

      <ConfirmationDialog
        confirmText={confirmAction?.kind === "purge" ? "Purge forever" : "Restore record"}
        description={
          confirmAction?.kind === "purge"
            ? `"${confirmAction.label}" will be permanently and irreversibly removed, including from every related record.`
            : `"${confirmAction?.label ?? ""}" will return to its live list exactly as it was.`
        }
        isDestructive={confirmAction?.kind === "purge"}
        onConfirm={runConfirmed}
        onOpenChange={(open) => !open && setConfirmAction(null)}
        open={confirmAction !== null}
        requireExactMatch={confirmAction?.kind === "purge" ? "purge" : undefined}
        title={
          confirmAction?.kind === "purge" ? "Purge this record?" : "Restore this record?"
        }
      />
    </div>
  );
}
