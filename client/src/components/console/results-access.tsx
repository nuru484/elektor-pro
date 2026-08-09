"use client";

// Shared "where are my results" tab for the agent, candidate and accreditor
// consoles. All three watch elections rather than run them, so the question
// they ask is the same: which of my elections can I actually see results for
// right now, and where do I click.
import { BarChart3, FileBarChart, Lock, Table2 } from "lucide-react";
import Link from "next/link";

import { CardTitleRow } from "@/components/console/card-title-row";
import { EmptyState } from "@/components/ui/states";
import { StatusBadge } from "@/components/ui/status-badge";

/** The election fields this tab needs, whichever console supplies them. */
export interface ResultsAccessElection {
  endDate: string;
  id: string;
  name: string;
  resultsPolicy?: string;
  resultsPublishedAt?: null | string;
  slug: string;
  startDate: string;
  status: string;
}

/**
 * Whether results are open to a non-staff viewer right now.
 *
 * This mirrors the server's visibility rule; it decides what the console
 * *offers*, never what it can reach - the results endpoint re-checks and
 * returns 403 regardless of what is rendered here.
 */
export const resultsViewable = (election: ResultsAccessElection): boolean => {
  if (election.resultsPublishedAt) return true;
  if (election.resultsPolicy === "LIVE") return true;
  return (
    election.resultsPolicy === "ON_CLOSE" &&
    ["ARCHIVED", "ENDED"].includes(election.status)
  );
};

function ResultsRow({ election }: { election: ResultsAccessElection }) {
  const open = resultsViewable(election);
  return (
    <li className="rounded-xl border border-border bg-card p-4">
      <CardTitleRow
        tag={<StatusBadge status={election.status} />}
        title={election.name}
        titleClassName="text-sm font-medium"
      />
      {open ? (
        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2">
          <Link
            className="inline-flex items-center gap-1.5 text-sm font-medium text-brand hover:underline"
            href={`/results/${election.slug}`}
          >
            <Table2 className="size-4" /> Full results
          </Link>
          <Link
            className="inline-flex items-center gap-1.5 text-sm font-medium text-brand hover:underline"
            href={`/results/${election.slug}/charts`}
          >
            <BarChart3 className="size-4" /> Charts
          </Link>
        </div>
      ) : (
        <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
          <Lock className="size-3.5 shrink-0" />
          {election.resultsPolicy === "MANUAL"
            ? "Results open when the organisers publish them."
            : "Results open when this election closes."}
        </p>
      )}
    </li>
  );
}

export function ResultsAccessTab({
  elections,
}: {
  elections: ResultsAccessElection[];
}) {
  if (elections.length === 0) {
    return (
      <EmptyState
        description="Results appear here for every election you are part of, as soon as they are open to view."
        icon={FileBarChart}
        title="No results yet"
      />
    );
  }
  // Viewable first: the whole point of the tab is what you can open now.
  const ordered = [...elections].sort(
    (a, b) => Number(resultsViewable(b)) - Number(resultsViewable(a)),
  );
  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {ordered.map((election) => (
        <ResultsRow election={election} key={election.id} />
      ))}
    </ul>
  );
}
