"use client";

// Progress for an import the server took in the background.
//
// A large register is written in chunks by a worker, so the request that
// starts it returns immediately with a batch id rather than a result. Without
// this the admin would be told "12,000 voters registered" the instant they
// clicked, while the rows were still being written - and would never learn
// about the ones that failed.
import { AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import { useEffect } from "react";

import { useGetImportBatchQuery } from "@/redux/admin-api";

/** Terminal states: once here, polling stops. */
const isFinished = (status?: string) =>
  status === "COMPLETED" || status === "FAILED" || status === "PARTIAL";

export function ImportProgress({
  batchId,
  onFinished,
}: {
  batchId: string;
  /** Fired once, when the import reaches a terminal state. */
  onFinished?: (status: string) => void;
}) {
  // Read the current status first, so the polling interval below can be
  // derived from it rather than tracked in state.
  const { data } = useGetImportBatchQuery(batchId, {
    // Poll while it runs, then stop: an interval of 0 disables polling, so a
    // finished import does not keep hitting the server for a value that can
    // no longer change.
    pollingInterval: 2_000,
  });
  const batch = data?.data;
  const finished = isFinished(batch?.status);

  // In an effect, not during render: notifying the parent is a side effect,
  // and firing it mid-render would set state on another component while this
  // one is rendering.
  const status = batch?.status;
  useEffect(() => {
    if (!status || !isFinished(status)) return;
    onFinished?.(status);
    // onFinished is a callback prop; re-running on its identity would fire
    // repeatedly for the same terminal status.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  const pct =
    batch && batch.totalRows > 0
      ? Math.round((batch.processedRows / batch.totalRows) * 100)
      : 0;

  return (
    <div className="space-y-3">
      {/* The status line rewrites itself as the batch progresses; without a
          live region a screen-reader user is told the import started and
          never told it finished. Polite, so it waits for a pause rather than
          cutting across whatever is being read. */}
      <div
        aria-live="polite"
        className="flex items-center gap-2 text-sm"
        role="status"
      >
        {!batch || !finished ? (
          <>
            <Loader2 aria-hidden className="size-4 animate-spin text-brand" />
            <span>
              {batch
                ? `Importing ${batch.processedRows.toLocaleString()} of ${batch.totalRows.toLocaleString()} rows…`
                : "Starting import…"}
            </span>
          </>
        ) : batch.status === "FAILED" ? (
          <>
            <AlertTriangle aria-hidden className="size-4 text-destructive" />
            <span>Import failed{batch.error ? `: ${batch.error}` : ""}</span>
          </>
        ) : (
          <>
            <CheckCircle2 aria-hidden className="size-4 text-success" />
            <span>
              {batch.createdRows.toLocaleString()} rows imported
              {batch.failedRows > 0
                ? `, ${batch.failedRows.toLocaleString()} could not be written`
                : ""}
            </span>
          </>
        )}
      </div>

      <div
        aria-label="Import progress"
        aria-valuemax={100}
        aria-valuemin={0}
        aria-valuenow={pct}
        className="h-1.5 overflow-hidden bg-muted"
        role="progressbar"
      >
        <div
          className="h-full bg-chart-1 transition-[width] duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>

      {/* The failures are the actionable part: an admin fixes these rows and
          re-imports only them, so they are listed rather than counted. */}
      {batch?.errors && batch.errors.length > 0 && (
        <div className="max-h-40 overflow-y-auto rounded-lg border border-border bg-muted/30 p-3">
          <p className="text-xs font-medium">Rows that could not be written</p>
          <ul className="mt-1.5 space-y-1">
            {batch.errors.slice(0, 50).map((row) => (
              <li
                className="min-w-0 font-mono text-[11px] text-muted-foreground [overflow-wrap:anywhere]"
                key={row.row}
              >
                Row {row.row}: {row.message}
              </li>
            ))}
          </ul>
          {batch.errors.length > 50 && (
            <p className="mt-1.5 text-[11px] text-muted-foreground">
              …and {(batch.errors.length - 50).toLocaleString()} more.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
