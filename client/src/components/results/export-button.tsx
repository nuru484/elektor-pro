"use client";

// Request a results export and collect it when it is ready.
//
// The server answers 202 with a job rather than the file: a large election's
// PDF renders slowly enough that streaming it back risks a proxy timeout. Two
// paths come out of that, and this handles both - when no queue is
// configured the server renders inline and the file is collectable
// immediately, so there is nothing to poll and the download starts at once.
import { Check, Download, Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { env } from "@/lib/env";
import {
  useGetExportJobQuery,
  useRequestResultsExportMutation,
} from "@/redux/admin-api";
import { getApiErrorMessage } from "@/utils/extract-api-error";

/** The download is authorized by the token, not the session. */
const downloadUrl = (token: string) => `${env.apiUrl}/exports/${token}`;

export function ResultsExportButton({
  electionId,
  format,
}: {
  electionId: string;
  format: "csv" | "pdf";
}) {
  const [request, { isLoading: requesting }] = useRequestResultsExportMutation();
  const [jobId, setJobId] = useState<null | string>(null);
  // Which job has already been handed to the browser. A ref, not state:
  // this only guards the one-shot download, and storing it in state would
  // mean setting state from an effect on every poll that returns READY.
  const handled = useRef<null | string>(null);

  const { data } = useGetExportJobQuery(
    { electionId, jobId: jobId ?? "" },
    { pollingInterval: 2_000, skip: jobId === null },
  );
  const job = data?.data;
  const status = job?.status;

  // Everything the button shows is derived from the poll rather than mirrored
  // into state, so there is nothing to keep in sync.
  const finished = status === "FAILED" || status === "READY";
  const working = requesting || (jobId !== null && !finished);
  const collected = status === "READY";

  useEffect(() => {
    if (!job || !jobId || handled.current === jobId) return;
    if (status === "READY") {
      handled.current = jobId;
      // A new tab rather than a fetch, so the browser's own download UI
      // handles a large file and the Content-Disposition filename.
      window.open(downloadUrl(job.downloadToken), "_blank");
      return;
    }
    if (status === "FAILED") {
      handled.current = jobId;
      toast.error(job.error ?? "The export could not be generated");
    }
    // Keyed on the outcome; `job` changes identity on every poll tick.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, jobId]);

  const start = async () => {
    handled.current = null;
    setJobId(null);
    try {
      const res = await request({ electionId, format }).unwrap();
      // No queue configured: the server rendered it inline, so it is already
      // collectable and there is nothing to poll.
      if (!res.data.queued) {
        window.open(downloadUrl(res.data.downloadToken), "_blank");
        return;
      }
      setJobId(res.data.id);
      toast.success("Generating the export; it will download when ready");
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Could not start the export"));
    }
  };

  return (
    <Button
      disabled={working}
      onClick={() => void start()}
      size="sm"
      title={
        format === "pdf"
          ? "Download the tally as a PDF document"
          : "Download the tally as a CSV spreadsheet"
      }
      variant="outline"
    >
      {working ? (
        <Loader2 className="size-4 animate-spin" />
      ) : collected ? (
        <Check className="size-4" />
      ) : (
        <Download className="size-4" />
      )}
      {format.toUpperCase()}
    </Button>
  );
}
