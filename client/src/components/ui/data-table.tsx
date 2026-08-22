// src/components/ui/data-table.tsx
//
// The ONE list-table scaffold. Every console data table (elections, voters,
// candidates, staff, audit, ...) shares the same orchestration: tanstack
// table setup, the table markup, empty-state semantics, loading skeletons and
// pagination. That lives here once; entity files keep only what is truly
// theirs - columns, the row-card content, the filter toolbar and action flows.
//
// Split into a hook + a shell so entity code OWNS the table instance: the
// toolbar (column toggles, selection count) and delete flows need it, and
// threading callbacks out of a monolithic component is worse than handing
// the instance in.
"use client";
import * as React from "react";
import {
  ColumnDef,
  ColumnFiltersState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  Row,
  RowData,
  SortingState,
  Table as TanstackTable,
  useReactTable,
  VisibilityState,
} from "@tanstack/react-table";
import { cn } from "@/lib/utils";

declare module "@tanstack/react-table" {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- required by the library's generic signature
  interface ColumnMeta<TData extends RowData, TValue> {
    /**
     * The table's primary column: it claims 40% of the table's width (the
     * cap no column may exceed) instead of sizing to its content, and its
     * text truncates at ~90% of that share - so long values use the room
     * available without ever forcing a horizontal scroll. Mark exactly one
     * column per table.
     */
    stretch?: boolean;
  }
}
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DataTablePagination } from "@/components/ui/data-table-pagination";
import { DataTableSkeleton } from "@/components/ui/data-table-skeleton";
import {
  FilteredEmpty,
  RowCardList,
  SkeletonRowCards,
} from "@/components/ui/table-bits";
import {
  hasActiveTableFilters,
  tableEmptyMode,
} from "@/components/ui/table-empty-logic";

/** The standard server-paginated table instance every entity table uses. */
export function useDataTable<TData>({
  columns,
  data,
  pageSize,
  totalCount,
  getRowId,
  enableRowSelection = true,
}: {
  columns: ColumnDef<TData>[];
  data: TData[];
  pageSize: number;
  totalCount: number;
  /** Stable row ids (e.g. `(row) => row.id`) so selection survives refetches. */
  getRowId?: (row: TData) => string;
  /** Gate selection entirely (e.g. suppressions hide it for non-admins). */
  enableRowSelection?: boolean;
}): TanstackTable<TData> {
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>(
    [],
  );
  const [columnVisibility, setColumnVisibility] =
    React.useState<VisibilityState>({});
  const [rowSelection, setRowSelection] = React.useState({});

  return useReactTable({
    data,
    columns,
    getRowId,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    enableRowSelection,
    state: { sorting, columnFilters, columnVisibility, rowSelection },
    manualPagination: true,
    manualFiltering: true,
    pageCount: Math.ceil(totalCount / pageSize),
  });
}

interface IDataTableProps<TData> {
  table: TanstackTable<TData>;
  loading: boolean;
  totalCount: number;
  page: number;
  pageSize: number;
  onPageChange?: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  /** The table's active query filters - drives the empty-state semantics. */
  filters: Record<string, unknown>;
  /** Clears every filter (the filtered-empty state's escape hatch). */
  onClearFilters: () => void;
  /** Plural label used in the filtered-empty copy, e.g. "donations". */
  entityLabel: string;
  /**
   * Rendered ALONE when the table has no rows and no filters are applied,
   * replacing toolbar, table and pagination (typically the module's
   * EmptyState with its create action).
   */
  emptyState: React.ReactNode;
  /** The entity's filter toolbar (selection bar, search, filters, chips). */
  toolbar?: React.ReactNode;
  /** One dense RowCard per row (the below-md rendering). */
  renderRowCard: (row: Row<TData>) => React.ReactNode;
  /** Forwarded to the md+ table skeleton (image/avatar second column). */
  skeletonShowAvatar?: boolean;
  /**
   * Makes the whole md+ table row clickable (pointer cursor + hover). Clicks
   * on interactive elements inside a row (links, buttons, selects, menu
   * items) never trigger it, so per-cell controls keep working.
   */
  onRowOpen?: (row: Row<TData>) => void;
  /** Tooltip shown while hovering a clickable row, e.g. "Open election". */
  rowOpenHint?: string;
}

/** True when the click landed on (or inside) an interactive element. */
const isInteractiveTarget = (target: EventTarget | null): boolean =>
  target instanceof Element &&
  target.closest("a,button,select,input,textarea,label,[role='menuitem'],[role='dialog']") !== null;

/**
 * Dual-render list body: row cards below md, the real table from md up, with
 * the shared empty-state semantics (no data + no filters gives a lone
 * EmptyState; a filtered miss keeps the toolbar and offers a clear action).
 */
export function DataTable<TData>({
  table,
  loading,
  totalCount,
  page,
  pageSize,
  onPageChange,
  onPageSizeChange,
  filters,
  onClearFilters,
  entityLabel,
  emptyState,
  toolbar,
  renderRowCard,
  skeletonShowAvatar = false,
  onRowOpen,
  rowOpenHint,
}: IDataTableProps<TData>) {
  const rows = table.getRowModel().rows;
  const hasData = !loading && rows.length > 0;
  const columnCount = table.getVisibleLeafColumns().length;
  const filtersActive = hasActiveTableFilters(filters);

  const emptyMode = tableEmptyMode(loading, rows.length, filtersActive);

  if (emptyMode === "no-data") {
    return <div className="w-full max-w-full">{emptyState}</div>;
  }

  return (
    <div className="w-full max-w-full space-y-6">
      {(totalCount > 0 || filtersActive) && toolbar}

      {/* Dual render: row cards below md, the real table from md up. */}
      <div className="rounded-md border overflow-hidden">
        {/* Phones: dense tappable row cards - no side-scroll. */}
        <RowCardList>
          {loading ? (
            <SkeletonRowCards rows={Math.min(pageSize, 8)} />
          ) : hasData ? (
            rows.map((row) => (
              <React.Fragment key={row.id}>{renderRowCard(row)}</React.Fragment>
            ))
          ) : (
            <li>
              <FilteredEmpty
                entityLabel={entityLabel}
                onClear={onClearFilters}
              />
            </li>
          )}
        </RowCardList>

        {/* From md up: the full table. */}
        <div className="hidden md:block overflow-x-auto">
          <Table className="min-w-full">
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <TableHead
                      key={header.id}
                      className={cn(
                        "whitespace-nowrap",
                        header.column.columnDef.meta?.stretch && "w-2/5",
                      )}
                    >
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext(),
                          )}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>

            <TableBody>
              {loading ? (
                <DataTableSkeleton
                  rowCount={pageSize}
                  columnCount={columnCount}
                  showAvatar={skeletonShowAvatar}
                />
              ) : hasData ? (
                rows.map((row) => (
                  <TableRow
                    key={row.id}
                    data-state={row.getIsSelected() && "selected"}
                    className={
                      onRowOpen ? "cursor-pointer hover:bg-muted/50" : "hover:bg-muted/50"
                    }
                    onClick={
                      onRowOpen
                        ? (e) => {
                            if (isInteractiveTarget(e.target)) return;
                            onRowOpen(row);
                          }
                        : undefined
                    }
                    title={onRowOpen ? rowOpenHint : undefined}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell
                        key={cell.id}
                        className={cn(
                          cell.column.columnDef.meta?.stretch && "w-2/5 max-w-0",
                        )}
                      >
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext(),
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={columnCount}>
                    <FilteredEmpty
                      entityLabel={entityLabel}
                      onClear={onClearFilters}
                    />
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Pagination appears once the data outgrows the default page size. */}
      {totalCount > 10 && (
        <DataTablePagination
          table={table}
          totalCount={totalCount}
          page={page}
          pageSize={pageSize}
          onPageChange={onPageChange}
          onPageSizeChange={onPageSizeChange}
        />
      )}
    </div>
  );
}
