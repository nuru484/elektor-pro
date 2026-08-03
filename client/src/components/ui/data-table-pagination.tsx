// src/components/ui/data-table-pagination.tsx
"use client";

import { Table } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  CheckSquare,
  Database,
} from "lucide-react";

interface ITablePaginationProps<TData> {
  table: Table<TData>;
  totalCount: number;
  page: number;
  pageSize: number;
  onPageChange?: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
}

export function DataTablePagination<TData>({
  table,
  totalCount,
  page,
  pageSize,
  onPageChange,
  onPageSizeChange,
}: ITablePaginationProps<TData>) {
  const selectedCount = table.getSelectedRowModel().rows.length;
  const totalPages = Math.ceil(totalCount / pageSize) || 1;

  const startItem = (page - 1) * pageSize + 1;
  const endItem = Math.min(page * pageSize, totalCount);
  const isSelected = selectedCount > 0;

  return (
    <div className="flex flex-wrap items-center justify-center lg:justify-between gap-3 px-4 sm:px-6 py-3 border-t bg-background text-sm text-muted-foreground">
      {/* Stats Section - wraps naturally */}
      <div className="flex flex-wrap items-center justify-center gap-3">
        <div className="flex items-center gap-2.5">
          {/* Icon */}
          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-sm bg-primary/10">
            {isSelected ? (
              <CheckSquare className="h-4 w-4 text-primary" />
            ) : (
              <Database className="h-4 w-4 text-primary/70" />
            )}
          </div>

          <div className="text-sm text-muted-foreground whitespace-nowrap">
            {isSelected ? (
              <>
                <span className="font-semibold text-foreground mr-1">
                  {selectedCount.toLocaleString()}
                </span>
                <span className="hidden lg:inline">rows selected | </span>
                <span className="lg:hidden">selected / </span>
                <span className="font-semibold text-foreground mr-1">
                  {totalCount.toLocaleString()}
                </span>
                <span className="hidden lg:inline"> total</span>
              </>
            ) : (
              <>
                <span className="font-semibold text-foreground mr-1">
                  {totalCount.toLocaleString()}
                </span>
                <span className="hidden lg:inline"> total rows</span>
                <span className="lg:hidden">rows</span>
              </>
            )}
          </div>
        </div>

        {/* Page size selector */}
        <div className="flex items-center gap-2.5">
          <label
            htmlFor="page-size"
            className="text-sm font-medium text-muted-foreground whitespace-nowrap"
          >
            <span className="hidden xl:inline">Rows per page</span>
            <span className="inline xl:hidden">Rows</span>
          </label>
          <Select
            value={pageSize.toString()}
            onValueChange={(value) => onPageSizeChange?.(Number(value))}
          >
            <SelectTrigger
              id="page-size"
              className="h-8 w-auto min-w-15 bg-card border-border hover:bg-accent focus:ring-1 focus:ring-primary focus:border-primary transition-colors"
            >
              <SelectValue placeholder={pageSize} />
            </SelectTrigger>
            <SelectContent side="top" className="min-w-15">
              {[5, 10, 20, 30, 50, 100].map((size) => (
                <SelectItem
                  key={size}
                  value={size.toString()}
                  className="cursor-pointer"
                >
                  {size}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Navigation Section - wraps naturally */}
      <div className="flex flex-wrap items-center justify-center gap-3">
        {/* Page Range Indicator */}
        <div className="flex items-center">
          <span className="text-sm font-medium whitespace-nowrap">
            <span className="hidden xl:inline">Showing </span>
            <span className="font-semibold text-foreground">
              {startItem.toLocaleString()}
            </span>
            -
            <span className="font-semibold text-foreground">
              {endItem.toLocaleString()}
            </span>
            <span className="hidden lg:inline"> of </span>
            <span className="lg:hidden">/</span>
            <span className="font-semibold text-foreground ml-1">
              {totalCount.toLocaleString()}
            </span>
          </span>
        </div>

        {/* Navigation buttons */}
        <nav
          className="flex items-center gap-0.5"
          aria-label="Pagination navigation"
        >
          {/* First Page (Hidden on small screens) */}
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8 rounded-r-none border-r-0 hidden md:flex"
            onClick={() => onPageChange?.(1)}
            disabled={page <= 1}
            aria-label="Go to first page"
          >
            <ChevronsLeft className="h-4 w-4" />
          </Button>

          {/* Previous Page */}
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8 rounded-r-none border-r-0 md:rounded-l-none md:rounded-r-none"
            onClick={() => onPageChange?.(Math.max(1, page - 1))}
            disabled={page <= 1}
            aria-label="Go to previous page"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>

          {/* Current Page Indicator */}
          <span className="text-sm px-3 font-semibold text-foreground hidden lg:inline whitespace-nowrap">
            Page {page}
          </span>

          {/* Next Page */}
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8 rounded-l-none border-l-0 md:rounded-l-none md:rounded-r-none"
            onClick={() => onPageChange?.(page + 1)}
            disabled={page >= totalPages}
            aria-label="Go to next page"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>

          {/* Last Page (Hidden on small screens) */}
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8 rounded-l-none hidden md:flex"
            onClick={() => onPageChange?.(totalPages)}
            disabled={page >= totalPages}
            aria-label="Go to last page"
          >
            <ChevronsRight className="h-4 w-4" />
          </Button>
        </nav>
      </div>
    </div>
  );
}
