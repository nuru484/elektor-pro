"use client";

import { Crown, Lock, Radio } from "lucide-react";
import { use } from "react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/states";
import { cn } from "@/lib/utils";
import { getApiErrorMessage } from "@/utils/extract-api-error";
import { useElectionSocket } from "@/hooks/use-election-socket";
import { useGetResultsQuery } from "@/redux/voting-api";
import type { PortfolioResult } from "@/types/api";

function PortfolioCard({ portfolio }: { portfolio: PortfolioResult }) {
  const max = Math.max(1, ...portfolio.candidates.map((c) => c.votes));
  return (
    <Card>
      <CardContent className="space-y-4 p-5">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">{portfolio.name}</h3>
          <span className="text-xs text-muted-foreground">
            {portfolio.totalVotes} votes
            {portfolio.skip ? ` · ${portfolio.skip} skipped` : ""}
          </span>
        </div>
        <div className="space-y-3">
          {portfolio.candidates.map((c) => {
            const leading = portfolio.winner?.id === c.id && c.votes > 0;
            return (
              <div key={c.id}>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span className="flex items-center gap-1.5 font-medium">
                    {leading && <Crown className="size-3.5 text-warning" />}
                    {c.name}
                    {c.nickname && <span className="text-xs font-normal text-muted-foreground">{c.nickname}</span>}
                  </span>
                  <span className="tabular-nums text-muted-foreground">
                    {c.votes} · {c.percentage}%
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className={cn("h-full rounded-full transition-all", leading ? "bg-brand" : "bg-muted-foreground/40")}
                    style={{ width: `${(c.votes / max) * 100}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

export default function ResultsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const { data, error, isLoading, refetch } = useGetResultsQuery(slug);
  const { connected } = useElectionSocket(data?.data.election.id, refetch);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-32 w-full rounded-xl" />
        <Skeleton className="h-48 w-full rounded-xl" />
      </div>
    );
  }

  if (error) {
    const status = (error as { status?: number }).status;
    return (
      <EmptyState
        description={
          status === 403
            ? "Results for this election aren't available to the public yet."
            : getApiErrorMessage(error, "This election could not be found.")
        }
        icon={Lock}
        title={status === 403 ? "Results not yet released" : "Unavailable"}
      />
    );
  }

  if (!data) return null;
  const { election, portfolios, turnout } = data.data;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold sm:text-3xl">{election.name}</h1>
            {election.status === "IN_PROGRESS" && connected && (
              <Badge variant="success"><Radio className="size-3 animate-pulse" /> Live</Badge>
            )}
            {election.certifiedAt && <Badge variant="brand">Certified</Badge>}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {turnout.totalVoted} of {turnout.totalEligible} voted · {turnout.percentage}% turnout
          </p>
        </div>
      </div>

      <Card>
        <CardContent className="p-5">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">Turnout</span>
            <span className="tabular-nums text-muted-foreground">{turnout.percentage}%</span>
          </div>
          <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-brand transition-all" style={{ width: `${turnout.percentage}%` }} />
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4">
        {portfolios.map((p) => <PortfolioCard key={p.id} portfolio={p} />)}
      </div>
    </div>
  );
}
