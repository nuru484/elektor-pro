"use client";

// The agent's console: every election they're assigned to observe, the full
// card of the candidate they represent (portfolio, ballot number, status),
// the election's shape (window, candidates, portfolios), live turnout, and a
// straight path to the results.
import { ArrowUpRight, CalendarClock, Eye } from "lucide-react";
import { useState } from "react";

import type { AgentDashboardRow } from "@/types/api";

import {
  ElectionFilterBar,
  EMPTY_ELECTION_FILTER,
  matchesElectionFilter,
  type ElectionFilter,
} from "@/components/console/election-filter-bar";
import { EntityAvatar } from "@/components/console/entity-avatar";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { LinkButton } from "@/components/ui/link-button";
import { CardGridSkeleton, Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState, PageHeader } from "@/components/ui/states";
import { StatusBadge } from "@/components/ui/status-badge";
import { useGetTurnoutQuery } from "@/redux/admin-api";
import { useGetAgentDashboardQuery } from "@/redux/governance-api";
import { formatDate } from "@/utils/format-date";

const fmt = (n: number) => n.toLocaleString();

/** Live turnout for one assigned election, refreshed every 30s. */
function TurnoutStats({ electionId }: { electionId: string }) {
  const { data, isLoading } = useGetTurnoutQuery(electionId, {
    pollingInterval: 30_000,
  });
  if (isLoading) return <Skeleton className="h-14 rounded-lg" />;
  const turnout = data?.data;
  if (!turnout) return null;
  return (
    <div
      className="grid grid-cols-3 gap-1 rounded-lg border border-border bg-muted/30 px-2 py-2 text-center"
      title="Live turnout, refreshed every 30 seconds"
    >
      <div className="min-w-0">
        <p className="text-[10px] font-medium text-muted-foreground uppercase">
          Registered
        </p>
        <p className="truncate font-mono text-sm font-semibold tabular-nums">
          {fmt(turnout.eligible)}
        </p>
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-medium text-muted-foreground uppercase">Voted</p>
        <p className="truncate font-mono text-sm font-semibold tabular-nums">
          {fmt(turnout.voted)}
        </p>
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-medium text-muted-foreground uppercase">Turnout</p>
        <p className="truncate font-mono text-sm font-semibold tabular-nums">
          {turnout.percentage}%
        </p>
      </div>
    </div>
  );
}

function AssignmentCard({ assignment }: { assignment: AgentDashboardRow }) {
  const { candidate, election } = assignment;
  const counts = election._count;
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          {/* line-clamp, not truncate: long election names wrap to two lines
              instead of stretching the card. */}
          <CardTitle
            className="min-w-0 line-clamp-2 text-base whitespace-normal [overflow-wrap:anywhere]"
            title={election.name}
          >
            {election.name}
          </CardTitle>
          <span className="shrink-0">
            <StatusBadge status={election.status} />
          </span>
        </div>
        <p
          className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground"
          title="The voting window"
        >
          <CalendarClock className="size-3.5 shrink-0" />
          <span className="truncate">
            {formatDate(election.startDate)} to {formatDate(election.endDate)}
          </span>
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Who this agent represents: the candidate's full card. */}
        {candidate ? (
          <div className="rounded-lg border border-border bg-muted/30 p-3">
            <div className="flex min-w-0 items-center gap-2.5">
              <EntityAvatar
                name={candidate.name}
                size="size-9"
                url={candidate.profilePicture}
              />
              <div className="min-w-0 flex-1">
                <p className="min-w-0 text-sm font-medium [overflow-wrap:anywhere]">
                  {candidate.name}
                  {candidate.nickname && (
                    <span className="ml-1.5 text-xs font-normal text-muted-foreground [overflow-wrap:anywhere]">
                      {candidate.nickname}
                    </span>
                  )}
                </p>
                <p className="min-w-0 text-xs text-muted-foreground [overflow-wrap:anywhere]">
                  {candidate.portfolio.name}
                  {candidate.ballotNumber != null
                    ? ` · Ballot no. ${String(candidate.ballotNumber)}`
                    : ""}
                </p>
              </div>
            </div>
            {/* Full contact: agents reach their candidate directly. */}
            {(candidate.account?.email ?? candidate.account?.phone) && (
              <div className="mt-2 space-y-0.5 border-t border-border pt-2">
                {candidate.account?.email && (
                  <p
                    className="min-w-0 text-xs text-muted-foreground [overflow-wrap:anywhere]"
                    title="The candidate's email"
                  >
                    {candidate.account.email}
                  </p>
                )}
                {candidate.account?.phone && (
                  <p
                    className="min-w-0 text-xs text-muted-foreground [overflow-wrap:anywhere]"
                    title="The candidate's phone"
                  >
                    {candidate.account.phone}
                  </p>
                )}
              </div>
            )}
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <StatusBadge status={candidate.status} />
              <span className="text-[11px] text-muted-foreground">
                You represent this candidate
              </span>
            </div>
          </div>
        ) : (
          <p
            className="rounded-lg border border-border bg-muted/30 p-3 text-xs text-muted-foreground"
            title="You observe the whole election, not one candidate"
          >
            General observer for this election
          </p>
        )}

        {counts && (
          <p className="text-xs text-muted-foreground" title="The election's shape">
            {fmt(counts.candidates)}{" "}
            {counts.candidates === 1 ? "candidate" : "candidates"} across{" "}
            {fmt(counts.portfolios)}{" "}
            {counts.portfolios === 1 ? "portfolio" : "portfolios"} ·{" "}
            {fmt(counts.voterElections)} on the roll
          </p>
        )}
        {/* Who may vote: the election's category and groups, plain text. */}
        {(election.eligibilityGroups?.length ?? 0) > 0 && (
          <p
            className="min-w-0 text-xs text-muted-foreground [overflow-wrap:anywhere]"
            title="The groups (and their categories) this election is scoped to"
          >
            Open to:{" "}
            {(election.eligibilityGroups ?? [])
              .map(({ group }) =>
                group.category ? `${group.name} (${group.category.name})` : group.name,
              )
              .join(", ")}
          </p>
        )}

        <TurnoutStats electionId={election.id} />
        <LinkButton
          className="w-full"
          href={`/results/${election.slug}`}
          title="Open this election's results page"
          variant="outline"
        >
          View results <ArrowUpRight className="size-4" />
        </LinkButton>
      </CardContent>
    </Card>
  );
}

export default function AgentDashboardPage() {
  const { data, isError, isLoading } = useGetAgentDashboardQuery();
  const [filter, setFilter] = useState<ElectionFilter>(EMPTY_ELECTION_FILTER);
  const all = data?.data ?? [];
  const assignments = all.filter((a) => matchesElectionFilter(a.election, filter));

  return (
    <div className="space-y-6">
      <PageHeader
        description="The elections you're assigned to observe: your candidate, the field, and live turnout."
        title="My assignments"
      />

      <ElectionFilterBar filter={filter} onChange={setFilter} />

      {isLoading ? (
        <CardGridSkeleton count={3} />
      ) : isError ? (
        <ErrorState />
      ) : assignments.length === 0 ? (
        <EmptyState
          description={
            all.length > 0
              ? "No assignment matches your search or period. Clear the filters to see everything."
              : "When an administrator assigns you to an election, it appears here."
          }
          icon={Eye}
          title={all.length > 0 ? "No matches" : "No assignments yet"}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {assignments.map((assignment) => (
            <AssignmentCard assignment={assignment} key={assignment.id} />
          ))}
        </div>
      )}
    </div>
  );
}
