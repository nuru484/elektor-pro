"use client";

// The agent's console. An agent holds ONE live posting at a time (the server
// refuses a second), so this is not a searchable list: it is the candidate
// they are observing now, the postings they have held before, and a straight
// path to results for any of them.
import { ArrowUpRight, CalendarClock, Eye } from "lucide-react";

import type { AgentDashboardRow } from "@/types/api";

import { CardTitleRow } from "@/components/console/card-title-row";
import { EntityAvatar } from "@/components/console/entity-avatar";
import { PhotoViewerTrigger } from "@/components/console/photo-viewer";
import { ResultsAccessTab } from "@/components/console/results-access";
import { Card, CardContent } from "@/components/ui/card";
import { LinkButton } from "@/components/ui/link-button";
import { CardGridSkeleton, Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
      {/* The same percentage as a meter, so a glance reads it without the
          numbers. */}
      <div
        aria-label={`Turnout ${turnout.percentage}%`}
        aria-valuemax={100}
        aria-valuemin={0}
        aria-valuenow={Math.round(turnout.percentage)}
        className="col-span-3 mt-1 h-1.5 overflow-hidden bg-muted"
        role="progressbar"
      >
        <div
          className="h-full bg-chart-1 transition-[width] duration-700"
          style={{ width: `${Math.min(turnout.percentage, 100)}%` }}
        />
      </div>
    </div>
  );
}

/**
 * The candidate this agent represents, given room: photo, portfolio, ballot
 * number, status and direct contact. This is the half of the console an
 * agent actually looks at, so it is not squeezed into a grid tile.
 */
function CurrentCandidatePanel({
  assignment,
}: {
  assignment: AgentDashboardRow;
}) {
  const { candidate } = assignment;
  return (
    <Card>
      <CardContent className="p-5">
        <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
          Your candidate
        </p>
        {candidate ? (
          <>
            <div className="mt-3 flex min-w-0 items-center gap-3">
              <PhotoViewerTrigger name={candidate.name} url={candidate.profilePicture}>
                <EntityAvatar
                  name={candidate.name}
                  size="size-14"
                  url={candidate.profilePicture}
                />
              </PhotoViewerTrigger>
              <div className="min-w-0">
                <p className="min-w-0 text-lg font-medium [overflow-wrap:anywhere]">
                  {candidate.name}
                </p>
                {candidate.nickname && (
                  <p className="min-w-0 text-sm text-muted-foreground [overflow-wrap:anywhere]">
                    {candidate.nickname}
                  </p>
                )}
              </div>
            </div>

            <dl className="mt-4 space-y-2 border-t border-border pt-3 text-sm">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                <dt className="text-muted-foreground">Portfolio</dt>
                <dd className="min-w-0 font-medium [overflow-wrap:anywhere]">
                  {candidate.portfolio.name}
                </dd>
              </div>
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                <dt className="text-muted-foreground">Ballot number</dt>
                <dd className="font-mono font-medium tabular-nums">
                  {candidate.ballotNumber ?? "Not assigned"}
                </dd>
              </div>
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                <dt className="text-muted-foreground">Nomination</dt>
                <dd>
                  <StatusBadge status={candidate.status} />
                </dd>
              </div>
              {candidate.account?.email && (
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                  <dt className="text-muted-foreground">Email</dt>
                  <dd className="min-w-0 [overflow-wrap:anywhere]">
                    {candidate.account.email}
                  </dd>
                </div>
              )}
              {candidate.account?.phone && (
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                  <dt className="text-muted-foreground">Phone</dt>
                  <dd className="min-w-0 [overflow-wrap:anywhere]">
                    {candidate.account.phone}
                  </dd>
                </div>
              )}
            </dl>
          </>
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">
            You observe this election as a whole, not one candidate.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

/** The election side: window, shape, who may vote, live turnout, results. */
function CurrentElectionPanel({
  assignment,
}: {
  assignment: AgentDashboardRow;
}) {
  const { election } = assignment;
  const counts = election._count;
  return (
    <Card>
      <CardContent className="space-y-3 p-5">
        <CardTitleRow
          meta={
            <span className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
              Election
            </span>
          }
          tag={<StatusBadge status={election.status} />}
          title={election.name}
          titleClassName="text-lg font-medium"
        />

        <p className="flex min-w-0 items-center gap-1.5 text-sm text-muted-foreground">
          <CalendarClock className="size-4 shrink-0" />
          <span className="min-w-0 [overflow-wrap:anywhere]">
            {formatDate(election.startDate)} to {formatDate(election.endDate)}
          </span>
        </p>

        {counts && (
          <p className="text-sm text-muted-foreground">
            {fmt(counts.candidates)}{" "}
            {counts.candidates === 1 ? "candidate" : "candidates"} across{" "}
            {fmt(counts.portfolios)}{" "}
            {counts.portfolios === 1 ? "portfolio" : "portfolios"} ·{" "}
            {fmt(counts.voterElections)} on the roll
          </p>
        )}

        {(election.eligibilityGroups?.length ?? 0) > 0 && (
          <p className="min-w-0 text-sm text-muted-foreground [overflow-wrap:anywhere]">
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

/**
 * One past posting. Deliberately flat - a single bordered card with rows,
 * no panel-inside-a-card: nesting panels stacks three borders and their
 * padding on a phone, leaving barely any width for the text. Everything that
 * can be long (election name, candidate name, portfolio) wraps on its own
 * line rather than sharing one.
 */
function HistoryCard({ assignment }: { assignment: AgentDashboardRow }) {
  const { candidate, election } = assignment;
  return (
    <Card>
      <CardContent className="p-4">
        <CardTitleRow
          tag={<StatusBadge status={election.status} />}
          title={election.name}
        />

        <p className="mt-1 flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
          <CalendarClock className="size-3.5 shrink-0" />
          <span className="min-w-0 [overflow-wrap:anywhere]">
            {formatDate(election.startDate)} to {formatDate(election.endDate)}
          </span>
        </p>

        {candidate ? (
          <div className="mt-3 flex min-w-0 items-center gap-2.5 border-t border-border pt-3">
            <PhotoViewerTrigger name={candidate.name} url={candidate.profilePicture}>
              <EntityAvatar
                name={candidate.name}
                size="size-9"
                url={candidate.profilePicture}
              />
            </PhotoViewerTrigger>
            <div className="min-w-0">
              <p className="min-w-0 text-sm font-medium [overflow-wrap:anywhere]">
                {candidate.name}
              </p>
              <p className="min-w-0 text-xs text-muted-foreground [overflow-wrap:anywhere]">
                {candidate.portfolio.name}
                {candidate.ballotNumber != null
                  ? ` · Ballot no. ${String(candidate.ballotNumber)}`
                  : ""}
              </p>
            </div>
          </div>
        ) : (
          <p className="mt-3 border-t border-border pt-3 text-xs text-muted-foreground">
            You observed this election as a whole, not one candidate.
          </p>
        )}

        <LinkButton
          className="mt-3 w-full"
          href={`/results/${election.slug}`}
          size="sm"
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
  const current = data?.data.current ?? null;
  const history = data?.data.history ?? [];
  const elections = [current, ...history]
    .filter((row) => row !== null)
    .map((row) => row.election);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader
          description="The candidate you are observing, and everything you have observed before."
          title="My assignment"
        />
        <CardGridSkeleton count={1} />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="space-y-6">
        <PageHeader
          description="The candidate you are observing, and everything you have observed before."
          title="My assignment"
        />
        <ErrorState />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        description="The candidate you are observing, and everything you have observed before."
        title="My assignment"
      />

      <Tabs className="gap-4" defaultValue="current">
        <TabsList>
          <TabsTrigger value="current">Current</TabsTrigger>
          <TabsTrigger value="history">History ({history.length})</TabsTrigger>
          <TabsTrigger value="results">Results</TabsTrigger>
        </TabsList>

        <TabsContent value="current">
          {current ? (
            /* One assignment, so it gets the width instead of pretending to
               be a card in a grid: the candidate and the election sit side
               by side from md, and stack on a phone. */
            <div className="grid gap-4 md:grid-cols-2">
              <CurrentCandidatePanel assignment={current} />
              <CurrentElectionPanel assignment={current} />
            </div>
          ) : (
            <EmptyState
              description="When an administrator posts you to an election, the candidate you represent appears here."
              icon={Eye}
              title="No current assignment"
            />
          )}
        </TabsContent>

        <TabsContent value="history">
          {history.length === 0 ? (
            <EmptyState
              description="Elections you have observed move here once they close, so you can always look back at what you watched."
              icon={CalendarClock}
              title="Nothing in your history yet"
            />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {history.map((assignment) => (
                <HistoryCard assignment={assignment} key={assignment.id} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="results">
          <ResultsAccessTab elections={elections} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
