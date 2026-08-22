"use client";

// Table timestamp: the date on top, its time below in smaller
// muted type - keeps columns narrow while showing both.
import { formatDate, formatTime } from "@/utils/format-date";

export function TableDate({ value }: { value: null | string | undefined }) {
  if (!value) return <span className="text-xs text-muted-foreground">—</span>;
  return (
    <div className="whitespace-nowrap">
      <p className="text-xs tabular-nums">{formatDate(value)}</p>
      <p className="text-[11px] tabular-nums text-muted-foreground">{formatTime(value)}</p>
    </div>
  );
}
