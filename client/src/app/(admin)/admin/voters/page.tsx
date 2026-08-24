"use client";

import { type ColumnDef, type Row } from "@tanstack/react-table";
import { Eye, FileUp, Pencil, Plus, Trash2, Users } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";

import type { Voter } from "@/types/api";

import { EntityAvatar } from "@/components/console/entity-avatar";
import { VoterImportDialog } from "@/components/console/import-dialog";
import { RowActionsMenu } from "@/components/console/row-actions";
import { TableDate } from "@/components/console/table-date";
import { TableToolbar } from "@/components/console/table-toolbar";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { DataTable, useDataTable } from "@/components/ui/data-table";
import { EmptyState, PageHeader } from "@/components/ui/states";
import { CellText, RowCard } from "@/components/ui/table-bits";
import { clearAllFiltersPatch } from "@/components/ui/table-empty-logic";
import { type TableFiltersSpec } from "@/hooks/table-query-state-logic";
import { useTableQueryState } from "@/hooks/use-table-query-state";
import {
  useDeleteVoterMutation,
  useListVotersQuery,
} from "@/redux/admin-api";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { useAuthRole } from "@/hooks/use-auth-role";
import { getApiErrorMessage } from "@/utils/extract-api-error";

interface VoterFilters extends Record<string, string | undefined> {
  search?: string;
}

const FILTERS_SPEC: TableFiltersSpec<VoterFilters> = {
  search: { kind: "string" },
};

const buildColumns = (
  isSuperAdmin: boolean,
  onDelete: (voter: Voter) => void,
): ColumnDef<Voter>[] => [
  {
    accessorKey: "name",
    cell: ({ row }) => (
      <div className="flex min-w-0 items-center gap-2.5">
        <EntityAvatar name={row.original.name} url={row.original.profilePicture} />
        <CellText className="max-w-[85%] flex-1 font-medium" text={row.original.name} />
      </div>
    ),
    header: "Name",
    meta: { stretch: true },
  },
  {
    accessorKey: "voterId",
    cell: ({ row }) => (
      <CellText className="max-w-40 font-mono text-xs" text={row.original.voterId} />
    ),
    header: "Voter ID",
  },
  {
    cell: ({ row }) => (
      <span className="text-sm text-muted-foreground">
        {row.original.phoneNumber ?? "—"}
      </span>
    ),
    header: "Phone",
    id: "phone",
  },
  {
    cell: ({ row }) => (
      <CellText
        className="max-w-48 text-xs text-muted-foreground"
        text={row.original.email ?? "—"}
      />
    ),
    header: "Email",
    id: "email",
  },
  {
    // Group names are admin-authored free text - plain truncated text, not badges.
    cell: ({ row }) => (
      <CellText
        className="max-w-44 text-xs text-muted-foreground"
        text={
          row.original.groupMemberships?.map(({ group }) => group.name).join(", ") || "—"
        }
      />
    ),
    header: "Groups",
    id: "groups",
  },
  {
    cell: ({ row }) => (
<TableDate value={row.original.createdAt} />
    ),
    header: "Registered",
    id: "registered",
  },
  {
    cell: ({ row }) => (
      <RowActionsMenu label="Voter actions">
        <DropdownMenuItem asChild>
          <Link href={`/admin/voters/${row.original.id}`}>
            <Eye className="size-4" /> View profile
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href={`/admin/voters/${row.original.id}?edit=1`}>
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

export default function VotersPage() {
  const { isSuperAdmin } = useAuthRole();
  const [importOpen, setImportOpen] = useState(false);
  const [deleting, setDeleting] = useState<null | Voter>(null);
  const [deleteVoter] = useDeleteVoterMutation();
  const {
    filters,
    handleFiltersChange,
    handlePageChange,
    handlePageSizeChange,
    page,
    pageSize,
    queryParams,
  } = useTableQueryState<VoterFilters>({ spec: FILTERS_SPEC });

  const { data, isFetching, isLoading } = useListVotersQuery(queryParams);

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
        description="The people eligible to vote in your elections."
        title="Voters"
      />

      <DataTable
        emptyState={
          <EmptyState
            action={
              <Button asChild variant="brand">
                <Link href="/admin/voters/new">
                  <Plus className="size-4" /> Add voter
                </Link>
              </Button>
            }
            description="Add voters individually or import them in bulk."
            icon={Users}
            title="No voters yet"
          />
        }
        entityLabel="voters"
        filters={filters}
        loading={isLoading || isFetching}
        onClearFilters={() => handleFiltersChange(clearAllFiltersPatch(filters))}
        onPageChange={handlePageChange}
        onPageSizeChange={handlePageSizeChange}
        page={page}
        pageSize={pageSize}
        renderRowCard={(row: Row<Voter>) => (
          <RowCard key={row.id}>
            <div className="flex items-center justify-between gap-2">
              <span className="min-w-0 truncate text-sm font-medium">
                {row.original.name}
              </span>
              <span className="max-w-[45%] shrink-0 truncate font-mono text-[11px] text-muted-foreground">
                {row.original.voterId}
              </span>
            </div>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              {row.original.phoneNumber ?? "No phone"}
              {row.original.groupMemberships?.length
                ? ` · ${row.original.groupMemberships.map((m) => m.group.name).join(", ")}`
                : ""}
            </p>
          </RowCard>
        )}
        table={table}
        toolbar={
          <TableToolbar
            actions={
              <>
                <Button
                  onClick={() => {
                    setImportOpen(true);
                  }}
                  variant="outline"
                >
                  <FileUp className="size-4" /> Import
                </Button>
                <Button asChild variant="brand">
                  <Link href="/admin/voters/new">
                    <Plus className="size-4" /> Add voter
                  </Link>
                </Button>
              </>
            }
            filters={filters}
            onClear={() => handleFiltersChange(clearAllFiltersPatch(filters))}
            onSearchChange={(value) => handleFiltersChange({ search: value || undefined })}
            search={filters.search ?? ""}
            searchPlaceholder="Search by name, ID, or phone…"
          />
        }
        totalCount={totalCount}
      />

      <VoterImportDialog
        key={importOpen ? "open" : "closed"}
        onClose={() => {
          setImportOpen(false);
        }}
        open={importOpen}
      />

      <ConfirmationDialog
        confirmText="Delete voter"
        description={`"${deleting?.name ?? ""}" (${deleting?.voterId ?? ""}) will be removed from the roll. They can be restored from Deleted records.`}
        isDestructive
        onConfirm={async () => {
          if (!deleting) return;
          setDeleting(null);
          try {
            await deleteVoter(deleting.id).unwrap();
            toast.success("Voter deleted");
          } catch (error) {
            toast.error(getApiErrorMessage(error));
          }
        }}
        onOpenChange={(open) => !open && setDeleting(null)}
        open={deleting !== null}
        requireExactMatch="delete"
        title="Delete this voter?"
      />
    </div>
  );
}
