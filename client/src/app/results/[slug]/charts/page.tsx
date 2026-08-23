"use client";

// The visual counterpart to the numbers on /results/[slug]: every race as a
// ranked bar chart beside its vote-share donut, over a turnout gauge. Same
// endpoint, same live socket invalidation - only the presentation differs, so
// the two pages can never disagree.
import { ArrowLeft, BarChart3, Crown, Radio, Table2 } from "lucide-react";
import Link from "next/link";
import { use } from "react";

import type { PortfolioResult } from "@/types/api";

import {
  NonVoteBreakdown,
  ShareDonut,
  TurnoutGauge,
  VoteBars,
} from "@/components/results/result-charts";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/states";
import { useElectionSocket } from "@/hooks/use-election-socket";
import { useGetResultsQuery } from "@/redux/voting-api";
import { getApiErrorMessage } from "@/utils/extract-api-error";

const fmt = (n: number) => n.toLocaleString();

function RaceCard({ portfolio }: { portfolio: PortfolioResult }) {
  // Highest first: a ranked chart is read top-down, and the winner should be
  // the first thing under the heading.
  const ranked = [...portfolio.candidates].sort((a, b) => b.votes - a.votes);

  return (
    <Card className="py-0">
      <CardContent className="p-5 md:p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="min-w-0 text-lg font-medium [overflow-wrap:anywhere]">
            {portfolio.name}
          </h2>
          <span className="font-mono text-xs tabular-nums text-muted-foreground">
            {fmt(portfolio.totalVotes)} votes
          </span>
        </div>

        {portfolio.isTied ? (
          <p className="mt-2 flex flex-wrap items-center gap-2 text-sm">
            <Badge variant="warning">Tied</Badge>
            <span className="text-muted-foreground">
              {portfolio.tiedCandidates.map((c) => c.name).join(" and ")} are
              level - this race has no winner until it is resolved.
            </span>
          </p>
        ) : portfolio.winner ? (
          <p className="mt-2 flex flex-wrap items-center gap-1.5 text-sm">
            <Crown aria-hidden className="size-4 shrink-0 text-brand" />
            <span className="min-w-0 [overflow-wrap:anywhere]">
              <b>{portfolio.winner.name}</b> leads with{" "}
              {portfolio.winner.percentage}%
            </span>
          </p>
        ) : null}

        {ranked.length === 0 || portfolio.totalVotes === 0 ? (
          <div className="mt-5 flex h-32 items-center justify-center rounded-lg border-2 border-dashed border-border/60 bg-secondary/30">
            <p className="text-sm text-muted-foreground">
              No votes recorded for this race yet.
            </p>
          </div>
        ) : (
          <div className="mt-5 grid gap-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
            <VoteBars candidates={ranked} />
            <ShareDonut candidates={ranked} />
          </div>
        )}

        <NonVoteBreakdown portfolio={portfolio} />
      </CardContent>
    </Card>
  );
}

export default function ResultsChartsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);
  const { data, error, isLoading, refetch } = useGetResultsQuery(slug);
  // Same live channel as the numbers page: a new ballot repaints both.
  useElectionSocket(data?.data.election.id, refetch);

  if (isLoading) {
    return (
      <main className="mx-auto max-w-5xl px-6 py-12">
        <Skeleton className="h-64 w-full rounded-xl" />
      </main>
    );
  }

  if (error || !data) {
    return (
      <main className="mx-auto max-w-5xl px-6 py-12">
        <EmptyState
          description={getApiErrorMessage(
            error,
            "These results are not available.",
          )}
          icon={BarChart3}
          title="Results unavailable"
        />
      </main>
    );
  }

  const { election, portfolios, turnout } = data.data;
  const live = election.status === "IN_PROGRESS";

  return (
    <main className="mx-auto max-w-5xl px-6 py-10 md:py-14">
      <Link
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        href={`/results/${slug}`}
      >
        <ArrowLeft className="size-4" /> Back to the full results
      </Link>

      <div className="mt-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-3xl font-medium [overflow-wrap:anywhere] md:text-4xl">
            {election.name}
          </h1>
          <p className="mt-1.5 text-muted-foreground">Results at a glance</p>
        </div>
        {live && (
          <Badge variant="brand">
            <Radio aria-hidden className="size-3.5" /> Live
          </Badge>
        )}
      </div>

      <Card className="py-0 mt-8">
        <CardContent className="p-5 md:p-6">
          <h2 className="mb-4 font-medium">Turnout</h2>
          <TurnoutGauge
            percentage={turnout.percentage}
            totalEligible={turnout.totalEligible}
            totalVoted={turnout.totalVoted}
          />
        </CardContent>
      </Card>

      <div className="mt-6 space-y-6">
        {portfolios.map((portfolio) => (
          <RaceCard key={portfolio.id} portfolio={portfolio} />
        ))}
      </div>

      {/* The numbers page is the table view for everything charted here. */}
      <Link
        className="mt-8 inline-flex items-center gap-1.5 text-sm font-medium text-brand hover:underline"
        href={`/results/${slug}`}
      >
        <Table2 className="size-4" /> See every figure in full
      </Link>
    </main>
  );
}
