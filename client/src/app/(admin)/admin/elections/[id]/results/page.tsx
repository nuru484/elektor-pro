"use client";

// Election workspace - Results tab: turnout and publication state at a
// glance. The full certification console (publish, certify, export) arrives
// with the results build; until then the public results page carries the
// live tally.
import { BarChart3, ExternalLink } from "lucide-react";
import Link from "next/link";
import { use } from "react";

import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/states";
import { useGetElectionQuery } from "@/redux/admin-api";
import { useGetResultsQuery } from "@/redux/voting-api";
import { getApiErrorMessage } from "@/utils/extract-api-error";

function Tile({ hint, label, value }: { hint?: string; label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 font-mono text-2xl font-semibold tabular-nums">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export default function ElectionResultsTab({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { data: electionData } = useGetElectionQuery(id);
  const { data, error, isError, isLoading } = useGetResultsQuery(id);
  const election = electionData?.data;
  const results = data?.data;

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-4 min-[420px]:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <Skeleton className="h-24 rounded-xl" key={i} />
        ))}
      </div>
    );
  }
  if (isError) {
    return <ErrorState message={getApiErrorMessage(error, "Could not load results")} />;
  }
  if (!results) return null;

  const publication = election?.certifiedAt
    ? { hint: new Date(election.certifiedAt).toLocaleString(), value: "Certified" }
    : election?.resultsPublishedAt
      ? {
          hint: new Date(election.resultsPublishedAt).toLocaleString(),
          value: "Published",
        }
      : { hint: "Results are not yet public", value: "Not published" };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 min-[420px]:grid-cols-2 lg:grid-cols-3">
        <Tile
          hint={`of ${String(results.turnout.totalEligible)} eligible`}
          label="Votes cast"
          value={String(results.turnout.totalVoted)}
        />
        <Tile label="Turnout" value={`${String(results.turnout.percentage)}%`} />
        <Tile hint={publication.hint} label="Publication" value={publication.value} />
      </div>

      <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-2.5">
          <BarChart3 className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          <div>
            <p className="text-sm font-medium">Live tally</p>
            <p className="text-xs text-muted-foreground">
              The public results page carries the per-portfolio tally with live
              updates. Publishing and certification controls land here in the
              results build.
            </p>
          </div>
        </div>
        {election && (
          <Link
            className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-border px-3 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
            href={`/results/${election.slug}`}
          >
            <ExternalLink className="size-3.5" /> Open results page
          </Link>
        )}
      </div>
    </div>
  );
}
