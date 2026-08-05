"use client";

import { type ColumnDef, type Row } from "@tanstack/react-table";
import { Eye, ListChecks, Pencil, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";

import type { Candidate } from "@/types/api";

import { EntityAvatar } from "@/components/console/entity-avatar";
import { RowActionsMenu } from "@/components/console/row-actions";
import { TableDate } from "@/components/console/table-date";
import { FilterField, TableToolbar } from "@/components/console/table-toolbar";
import { Button } from "@/components/ui/button";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { DataTable, useDataTable } from "@/components/ui/data-table";
import { Select as NativeSelect } from "@/components/ui/input";
import { EmptyState, PageHeader } from "@/components/ui/states";
import { CellText, RowCard } from "@/components/ui/table-bits";
import { clearAllFiltersPatch } from "@/components/ui/table-empty-logic";
import { type TableFiltersSpec } from "@/hooks/table-query-state-logic";
import { useTableQueryState } from "@/hooks/use-table-query-state";
import {
  useDeleteCandidateMutation,
  useListCandidatesQuery,
  useListElectionsQuery,
} from "@/redux/admin-api";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { useAuthRole } from "@/hooks/use-auth-role";
import { getApiErrorMessage } from "@/utils/extract-api-error";

interface CandidateFilters extends Record<string, string | undefined> {
  electionId?: string;
  search?: string;
}

const FILTERS_SPEC: TableFiltersSpec<CandidateFilters> = {
  electionId: { kind: "string" },
  search: { kind: "string" },
};

const buildColumns = (
  isSuperAdmin: boolean,
  onDelete: (candidate: Candidate) => void,
): ColumnDef<Candidate>[] => [
  {
    accessorKey: "name",
    cell: ({ row }) => (
      <div className="flex min-w-0 items-center gap-2.5">
        <EntityAvatar name={row.original.name} url={row.original.profilePicture} />
        <CellText className="max-w-[85%] flex-1 font-medium" text={row.original.name} />
      </div>
    ),
    header: "Candidate",
    meta: { stretch: true },
  },
  {
    cell: ({ row }) => (
      <CellText
        className="max-w-44 text-sm text-muted-foreground"
        text={row.original.portfolio?.name ?? "—"}
      />
    ),
    header: "Portfolio",
    id: "portfolio",
  },
  {
    cell: ({ row }) => (
      <CellText
        className="max-w-40 text-sm text-muted-foreground"
        text={row.original.nickname ?? "—"}
      />
    ),
    header: "Nickname",
    id: "nickname",
  },
  {
    cell: ({ row }) => (
      <div className="min-w-0">
        <CellText
          className="max-w-48 text-xs text-muted-foreground"
          text={row.original.account?.email ?? "—"}
        />
        <CellText
          className="max-w-48 text-xs text-muted-foreground"
          text={row.original.account?.phone ?? "—"}
        />
      </div>
    ),
    header: "Contact",
    id: "contact",
  },
  {
    cell: ({ row }) => (
<TableDate value={row.original.createdAt} />
    ),
    header: "Added",
    id: "added",
  },
  {
    cell: ({ row }) => (
      <RowActionsMenu label="Candidate actions">
        <DropdownMenuItem asChild>
          <Link href={`/admin/candidates/${row.original.id}`}>
            <Eye className="size-4" /> View profile
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href={`/admin/candidates/${row.original.id}?edit=1`}>
            <Pencil className="size-4" /> Edit
          </Link>
        </DropdownMenuItem>
        {isSuperAdmin && (
          <DropdownMenuItem onClick={() => onDelete(row.original)} variant="destructive">
            <Trash2 className="size-4" /> Delete
          </DropdownMenuItem>
        )}
      </RowActionsMenu>
    ),
    header: "Actions",
    id: "actions",
  },
];

export default function CandidatesPage() {
  const { isSuperAdmin } = useAuthRole();
  const [deleting, setDeleting] = useState<Candidate | null>(null);
  const [deleteCandidate] = useDeleteCandidateMutation();
  const {
    filters,
    handleFiltersChange,
    handlePageChange,
    handlePageSizeChange,
    page,
    pageSize,
    queryParams,
  } = useTableQueryState<CandidateFilters>({ spec: FILTERS_SPEC });

  const { data, isFetching, isLoading } = useListCandidatesQuery(queryParams);
  const { data: elections } = useListElectionsQuery({ limit: 100 });

  const rows = data?.data ?? [];
  const totalCount = data?.meta.total ?? 0;

  const table = useDataTable({
    columns: buildColumns(isSuperAdmin, setDeleting),
    data: rows,
    enableRowSelection: false,
    getRowId: (row) => row.id,
    pageSize,
    totalCount,
  });

  return (
    <div className="space-y-6">
      <PageHeader
        description="Candidates contesting across your elections."
        title="Candidates"
      />

      <DataTable
        emptyState={
          <EmptyState
            action={
              <Button asChild variant="brand">
                <Link href="/admin/candidates/new">
                  <Plus className="size-4" /> Add candidate
                </Link>
              </Button>
            }
            description="Add candidates once your election and portfolios exist."
            icon={ListChecks}
            title="No candidates yet"
          />
        }
        entityLabel="candidates"
        filters={filters}
        loading={isLoading || isFetching}
        onClearFilters={() => handleFiltersChange(clearAllFiltersPatch(filters))}
        onPageChange={handlePageChange}
        onPageSizeChange={handlePageSizeChange}
        page={page}
        pageSize={pageSize}
        renderRowCard={(row: Row<Candidate>) => (
          <RowCard key={row.id}>
            <div className="flex items-center justify-between gap-2">
              <span className="min-w-0 truncate text-sm font-medium">
                {row.original.name}
              </span>
            </div>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              {row.original.portfolio?.name ?? "No portfolio"}
              {row.original.nickname ? ` · ${row.original.nickname}` : ""}
            </p>
          </RowCard>
        )}
        table={table}
        toolbar={
          <TableToolbar
            actions={
              <Button asChild variant="brand">
                <Link href="/admin/candidates/new">
                  <Plus className="size-4" /> Add candidate
                </Link>
              </Button>
            }
            filters={filters}
            onClear={() => handleFiltersChange(clearAllFiltersPatch(filters))}
            onSearchChange={(value) => handleFiltersChange({ search: value || undefined })}
            search={filters.search ?? ""}
            searchPlaceholder="Search candidates…"
          >
            <FilterField caption="Election">
              <NativeSelect
                className="w-full lg:w-52"
                onChange={(e) =>
                  handleFiltersChange({
                    electionId: e.target.value === "all" ? undefined : e.target.value,
                  })
                }
                value={filters.electionId ?? "all"}
              >
                <option value="all">All elections</option>
                {elections?.data.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name}
                  </option>
                ))}
              </NativeSelect>
            </FilterField>
          </TableToolbar>
        }
        totalCount={totalCount}
      />

      <ConfirmationDialog
        confirmText="Delete candidate"
        description={`"${deleting?.name ?? ""}" will be withdrawn from the ballot. They can be restored from Deleted records.`}
        isDestructive
        onConfirm={async () => {
          if (!deleting) return;
          setDeleting(null);
          try {
            await deleteCandidate(deleting.id).unwrap();
            toast.success("Candidate deleted");
          } catch (error) {
            toast.error(getApiErrorMessage(error));
          }
        }}
        onOpenChange={(open) => !open && setDeleting(null)}
        open={deleting !== null}
        requireExactMatch="delete"
        title="Delete this candidate?"
      />
    </div>
  );
}
