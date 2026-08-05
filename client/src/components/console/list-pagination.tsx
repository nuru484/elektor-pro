"use client";

// Compact pager for card lists (voter/agent/candidate consoles): true
// server-side pagination - Prev/Next drive the query's page param.
import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";

import type { PaginationMeta } from "@/types/api";

export function ListPagination({
  meta,
  onPageChange,
}: {
  meta: PaginationMeta | undefined;
  onPageChange: (page: number) => void;
}) {
  if (!meta || meta.totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-xs text-muted-foreground">
        Page {meta.page} of {meta.totalPages} · {meta.total.toLocaleString()} total
      </span>
      <div className="flex gap-1.5">
        <Button
          disabled={meta.page <= 1}
          onClick={() => {
            onPageChange(meta.page - 1);
          }}
          size="sm"
          title="Previous page"
          variant="outline"
        >
          <ChevronLeft className="size-4" /> Prev
        </Button>
        <Button
          disabled={meta.page >= meta.totalPages}
          onClick={() => {
            onPageChange(meta.page + 1);
          }}
          size="sm"
          title="Next page"
          variant="outline"
        >
          Next <ChevronRight className="size-4" />
        </Button>
      </div>
    </div>
  );
}
