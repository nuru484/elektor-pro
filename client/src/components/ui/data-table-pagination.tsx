// src/components/ui/data-table-pagination.tsx
//
// Minimalist pagination: rows-per-page, the "1-12 of 12" range (the only
// count shown), and prev/next - one row on every screen size. First/last
// jumps join on sm+.
"use client";

import { Table } from "@tanstack/react-table";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface ITablePaginationProps<TData> {
  onPageChange?: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  page: number;
  pageSize: number;
  table: Table<TData>;
  totalCount: number;
}

export function DataTablePagination<TData>({
  onPageChange,
  onPageSizeChange,
  page,
  pageSize,
  totalCount,
}: ITablePaginationProps<TData>) {
  const totalPages = Math.ceil(totalCount / pageSize) || 1;
  const startItem = (page - 1) * pageSize + 1;
  const endItem = Math.min(page * pageSize, totalCount);

  return (
    <div className="flex items-center justify-between gap-3 border-t bg-background px-3 py-2.5 text-sm text-muted-foreground sm:px-4">
      {/* Rows per page */}
      <div className="flex items-center gap-2">
        <label className="hidden text-xs whitespace-nowrap sm:inline" htmlFor="page-size">
          Rows
        </label>
        <Select
          onValueChange={(value) => onPageSizeChange?.(Number(value))}
          value={pageSize.toString()}
        >
          <SelectTrigger className="h-8 w-auto min-w-16" id="page-size" size="sm">
            <SelectValue placeholder={pageSize} />
          </SelectTrigger>
          <SelectContent side="top">
            {[5, 10, 20, 30, 50, 100].map((size) => (
              <SelectItem key={size} value={size.toString()}>
                {size}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Range + navigation */}
      <div className="flex items-center gap-2 sm:gap-3">
        <span className="text-xs whitespace-nowrap tabular-nums">
          {startItem.toLocaleString()}–{endItem.toLocaleString()} of{" "}
          {totalCount.toLocaleString()}
        </span>
        <nav aria-label="Pagination" className="flex items-center gap-0.5">
          <Button
            aria-label="First page"
            className="hidden sm:inline-flex"
            disabled={page <= 1}
            onClick={() => onPageChange?.(1)}
            size="icon-sm"
            variant="ghost"
          >
            <ChevronsLeft className="size-4" />
          </Button>
          <Button
            aria-label="Previous page"
            disabled={page <= 1}
            onClick={() => onPageChange?.(Math.max(1, page - 1))}
            size="icon-sm"
            variant="ghost"
          >
            <ChevronLeft className="size-4" />
          </Button>
          <Button
            aria-label="Next page"
            disabled={page >= totalPages}
            onClick={() => onPageChange?.(page + 1)}
            size="icon-sm"
            variant="ghost"
          >
            <ChevronRight className="size-4" />
          </Button>
          <Button
            aria-label="Last page"
            className="hidden sm:inline-flex"
            disabled={page >= totalPages}
            onClick={() => onPageChange?.(totalPages)}
            size="icon-sm"
            variant="ghost"
          >
            <ChevronsRight className="size-4" />
          </Button>
        </nav>
      </div>
    </div>
  );
}
