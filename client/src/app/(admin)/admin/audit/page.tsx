"use client";

import { type ColumnDef, type Row } from "@tanstack/react-table";
import { ScrollText, ShieldCheck, ShieldX } from "lucide-react";

import { FilterField, TableToolbar } from "@/components/console/table-toolbar";
import { Badge } from "@/components/ui/badge";
import { DataTable, useDataTable } from "@/components/ui/data-table";
import { Input, Select as NativeSelect } from "@/components/ui/input";
import { EmptyState, PageHeader } from "@/components/ui/states";
import { RowCard } from "@/components/ui/table-bits";
import { clearAllFiltersPatch } from "@/components/ui/table-empty-logic";
import {
  type TableFiltersSpec,
} from "@/hooks/table-query-state-logic";
import { useTableQueryState } from "@/hooks/use-table-query-state";
import { type AuditLogRow, useListAuditLogsQuery, useVerifyAuditQuery } from "@/redux/admin-api";
import { formatDateTime } from "@/utils/format-date";

const ENTITIES = [
  "User",
  "Voter",
  "Election",
  "Candidate",
  "ChangeRequest",
  "AccessGrant",
  "AgentAssignment",
  "Organization",
] as const;

interface AuditFilters extends Record<string, string | undefined> {
  entity?: string;
  from?: string;
  search?: string;
  to?: string;
}

const FILTERS_SPEC: TableFiltersSpec<AuditFilters> = {
  entity: { kind: "enum", values: ENTITIES },
  from: { kind: "string" },
  search: { kind: "string" },
  to: { kind: "string" },
};

const actorName = (log: AuditLogRow): string =>
  log.actor ? `${log.actor.firstName} ${log.actor.lastName}` : "System";

const COLUMNS: ColumnDef<AuditLogRow>[] = [
  {
    accessorKey: "createdAt",
    cell: ({ row }) => (
      <time className="text-xs whitespace-nowrap tabular-nums text-muted-foreground">
        {formatDateTime(row.original.createdAt)}
      </time>
    ),
    header: "Time",
  },
  {
    accessorKey: "action",
    cell: ({ row }) => <span className="font-medium">{row.original.action}</span>,
    header: "Action",
  },
  {
    cell: ({ row }) => (
      <div className="min-w-0">
        <p className="text-sm">{actorName(row.original)}</p>
        {row.original.actor && (
          <p className="text-xs text-muted-foreground">
            {row.original.actor.role.replace("_", " ").toLowerCase()}
          </p>
        )}
      </div>
    ),
    header: "By",
    id: "actor",
  },
  {
    accessorKey: "entity",
    cell: ({ row }) => <Badge variant="outline">{row.original.entity}</Badge>,
    header: "Entity",
  },
  {
    cell: ({ row }) => (
      <span className="font-mono text-xs text-muted-foreground">
        {row.original.ipAddress ?? "—"}
      </span>
    ),
    header: "IP address",
    id: "ip",
  },
];

export default function AuditPage() {
  const {
    filters,
    handleFiltersChange,
    handlePageChange,
    handlePageSizeChange,
    page,
    pageSize,
    queryParams,
  } = useTableQueryState<AuditFilters>({ defaultPageSize: 20, spec: FILTERS_SPEC });

  const { data, isFetching, isLoading } = useListAuditLogsQuery(queryParams);
  const { data: integrity } = useVerifyAuditQuery();

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
          integrity &&
          (integrity.data.valid ? (
            <Badge variant="success">
              <ShieldCheck className="size-3" /> Chain verified
            </Badge>
          ) : (
            <Badge variant="destructive">
              <ShieldX className="size-3" /> Tampered at #{integrity.data.brokenAt}
            </Badge>
          ))
        }
        description="A tamper-evident, hash-chained record of every action - who did it, and from where."
        title="Audit trail"
      />

      <DataTable
        emptyState={<EmptyState icon={ScrollText} title="No activity yet" />}
        entityLabel="audit entries"
        filters={filters}
        loading={isLoading || isFetching}
        onClearFilters={() => handleFiltersChange(clearAllFiltersPatch(filters))}
        onPageChange={handlePageChange}
        onPageSizeChange={handlePageSizeChange}
        page={page}
        pageSize={pageSize}
        renderRowCard={(row: Row<AuditLogRow>) => (
          <RowCard key={row.id}>
            <div className="flex items-center justify-between gap-2">
              <span className="min-w-0 truncate text-sm font-medium">
                {row.original.action}
              </span>
              <time className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
                {formatDateTime(row.original.createdAt)}
              </time>
            </div>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              {actorName(row.original)} · {row.original.entity}
              {row.original.ipAddress ? ` · ${row.original.ipAddress}` : ""}
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
            searchPlaceholder="Search action, entity, actor, or IP…"
          >
            <FilterField caption="Entity">
              <NativeSelect
                className="w-full lg:w-44"
                onChange={(e) =>
                  handleFiltersChange({
                    entity: e.target.value === "all" ? undefined : e.target.value,
                  })
                }
                value={filters.entity ?? "all"}
              >
                <option value="all">All entities</option>
                {ENTITIES.map((entity) => (
                  <option key={entity} value={entity}>
                    {entity}
                  </option>
                ))}
              </NativeSelect>
            </FilterField>
            {/* Date range: whole-day inclusive on both ends (server handles
                the exclusive next-day upper bound). */}
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
    </div>
  );
}
