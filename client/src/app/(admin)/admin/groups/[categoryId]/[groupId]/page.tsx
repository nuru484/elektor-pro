"use client";

// Group detail: one group's facts (category, code, description) and the
// voters who belong to it - the drill-down from a category's group list.
import { type ColumnDef, type Row } from "@tanstack/react-table";
import { Users } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { use } from "react";

import type { Voter } from "@/types/api";

import { EntityAvatar } from "@/components/console/entity-avatar";
import { TableToolbar } from "@/components/console/table-toolbar";
import { DataTable, useDataTable } from "@/components/ui/data-table";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { CellText, RowCard } from "@/components/ui/table-bits";
import { type TableFiltersSpec } from "@/hooks/table-query-state-logic";
import { useTableQueryState } from "@/hooks/use-table-query-state";
import { useListVotersQuery } from "@/redux/admin-api";
import { useGetGroupQuery } from "@/redux/governance-api";
import { getApiErrorMessage } from "@/utils/extract-api-error";

interface MemberFilters extends Record<string, string | undefined> {
  search?: string;
}

const FILTERS_SPEC: TableFiltersSpec<MemberFilters> = {
  search: { kind: "string" },
};

const COLUMNS: ColumnDef<Voter>[] = [
  {
    accessorKey: "name",
    cell: ({ row }) => (
      <div className="flex min-w-0 items-center gap-2.5">
        <EntityAvatar name={row.original.name} url={row.original.profilePicture} />
        <CellText className="max-w-[85%] flex-1 font-medium" text={row.original.name} />
      </div>
    ),
    header: "Member",
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
];

export default function GroupDetailPage({
  params,
}: {
  params: Promise<{ categoryId: string; groupId: string }>;
}) {
  const { categoryId, groupId } = use(params);
  const router = useRouter();
  const {
    data: groupData,
    error: groupError,
    isError: groupIsError,
    isLoading: groupLoading,
  } = useGetGroupQuery(groupId);
  const group = groupData?.data;

  const {
    filters,
    handleFiltersChange,
    handlePageChange,
    handlePageSizeChange,
    page,
    pageSize,
    queryParams,
  } = useTableQueryState<MemberFilters>({ spec: FILTERS_SPEC });

  const { data, isFetching, isLoading } = useListVotersQuery({
    ...queryParams,
    groupId,
  });
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

  if (groupIsError) {
    return <ErrorState message={getApiErrorMessage(groupError, "Could not load this group")} />;
  }

  return (
    <div className="space-y-5">
      {groupLoading || !group ? (
        <div className="space-y-2">
          <Skeleton className="h-7 w-56" />
          <Skeleton className="h-4 w-72" />
        </div>
      ) : (
        <div className="min-w-0 space-y-1">
          <h1 className="min-w-0 text-xl font-semibold [overflow-wrap:anywhere] sm:text-2xl">
            {group.name}
          </h1>
          <p className="text-sm text-muted-foreground">
            <span className="font-mono text-xs">{group.code}</span>
            {" · "}
            <Link
              className="hover:text-brand"
              href={`/admin/groups/${categoryId}`}
              title="Open the category"
            >
              {group.category?.name ?? "Category"}
            </Link>
            {" · "}
            {totalCount} members
          </p>
          {group.description && (
            <p className="min-w-0 text-sm text-muted-foreground [overflow-wrap:anywhere]">
              {group.description}
            </p>
          )}
        </div>
      )}

      <DataTable
        emptyState={
          <EmptyState
            description="Voters join this group from their profile or the voter form; whole-group roll additions and scoped elections build on it."
            icon={Users}
            title="No members yet"
          />
        }
        entityLabel="members"
        filters={filters}
        loading={isLoading || isFetching}
        onClearFilters={() => {
          handleFiltersChange({ search: undefined });
        }}
        onPageChange={handlePageChange}
        onPageSizeChange={handlePageSizeChange}
        onRowOpen={(row: Row<Voter>) => {
          router.push(`/admin/voters/${row.original.id}`);
        }}
        page={page}
        pageSize={pageSize}
        renderRowCard={(row: Row<Voter>) => (
          <RowCard
            key={row.id}
            onOpen={() => {
              router.push(`/admin/voters/${row.original.id}`);
            }}
          >
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
            </p>
          </RowCard>
        )}
        rowOpenHint="Open this voter's profile"
        table={table}
        toolbar={
          <TableToolbar
            filters={filters}
            onClear={() => {
              handleFiltersChange({ search: undefined });
            }}
            onSearchChange={(value) => {
              handleFiltersChange({ search: value || undefined });
            }}
            search={filters.search ?? ""}
            searchPlaceholder="Search members…"
          />
        }
        totalCount={totalCount}
      />
    </div>
  );
}
