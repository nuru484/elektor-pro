import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "./button";

export function Pagination({
  meta,
  onPageChange,
}: {
  meta: { limit: number; page: number; total: number; totalPages: number };
  onPageChange: (page: number) => void;
}) {
  if (meta.total === 0) return null;
  const from = (meta.page - 1) * meta.limit + 1;
  const to = Math.min(meta.page * meta.limit, meta.total);
  return (
    <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
      <p className="text-xs text-muted-foreground">
        Showing <span className="font-medium text-foreground">{from}</span>–
        <span className="font-medium text-foreground">{to}</span> of{" "}
        <span className="font-medium text-foreground">{meta.total}</span>
      </p>
      <div className="flex items-center gap-2">
        <Button
          disabled={meta.page <= 1}
          onClick={() => onPageChange(meta.page - 1)}
          size="sm"
          variant="outline"
        >
          <ChevronLeft /> Prev
        </Button>
        <span className="text-xs tabular-nums text-muted-foreground">
          {meta.page} / {meta.totalPages}
        </span>
        <Button
          disabled={meta.page >= meta.totalPages}
          onClick={() => onPageChange(meta.page + 1)}
          size="sm"
          variant="outline"
        >
          Next <ChevronRight />
        </Button>
      </div>
    </div>
  );
}
