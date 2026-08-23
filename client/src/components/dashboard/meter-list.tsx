// Labeled horizontal meters - the workhorse for "magnitude per named thing"
// (turnout per election, elections per status). Labels carry identity, so
// every meter uses the single brand series color; values are printed, not
// inferred from length.
import { cn } from "@/lib/utils";

export interface MeterRow {
  detail?: string;
  href?: string;
  label: string;
  /** 0-100 fill; when omitted, `value` is scaled against the row max. */
  percentage?: number;
  value: number;
}

export function MeterList({
  ariaLabel,
  emptyText,
  rows,
}: {
  ariaLabel: string;
  emptyText: string;
  rows: MeterRow[];
}) {
  if (rows.length === 0) {
    return (
      <div className="flex h-32 items-center justify-center rounded-lg border-2 border-dashed border-border/60 bg-secondary/30">
        <p className="text-sm text-muted-foreground">{emptyText}</p>
      </div>
    );
  }

  const max = Math.max(...rows.map((row) => row.value), 1);

  return (
    <ul aria-label={ariaLabel} className="space-y-4">
      {rows.map((row) => {
        const pct = row.percentage ?? (row.value / max) * 100;
        return (
          <li key={row.label}>
            <div className="flex items-baseline justify-between gap-3">
              <span
                className={cn(
                  "min-w-0 text-sm font-medium",
                  "[overflow-wrap:anywhere] line-clamp-1",
                )}
              >
                {row.label}
              </span>
              <span className="flex-none font-mono text-xs tabular-nums text-muted-foreground">
                {row.detail ?? row.value.toLocaleString()}
              </span>
            </div>
            <div
              aria-label={`${row.label}: ${row.detail ?? row.value}`}
              aria-valuemax={100}
              aria-valuemin={0}
              aria-valuenow={Math.round(pct)}
              className="mt-1.5 h-1.5 overflow-hidden bg-muted"
              role="progressbar"
            >
              <div
                className="h-full bg-chart-1"
                style={{ width: `${Math.min(pct, 100)}%` }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
