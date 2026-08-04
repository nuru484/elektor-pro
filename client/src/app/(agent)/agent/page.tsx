"use client";

// The agent's dashboard: every election they're assigned to observe, who
// they represent there, live turnout, and a straight path to the results.
import { ArrowUpRight, Eye } from "lucide-react";

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
    <div className="grid grid-cols-3 gap-2 rounded-lg border border-border bg-muted/30 px-2 py-2 text-center">
      <div>
        <p className="text-[10px] font-medium text-muted-foreground uppercase">Eligible</p>
        <p className="font-mono text-sm font-semibold tabular-nums">
          {fmt(turnout.eligible)}
        </p>
      </div>
      <div>
        <p className="text-[10px] font-medium text-muted-foreground uppercase">Voted</p>
        <p className="font-mono text-sm font-semibold tabular-nums">
          {fmt(turnout.voted)}
        </p>
      </div>
      <div>
        <p className="text-[10px] font-medium text-muted-foreground uppercase">Turnout</p>
        <p className="font-mono text-sm font-semibold tabular-nums">
          {turnout.percentage}%
        </p>
      </div>
    </div>
  );
}

export default function AgentDashboardPage() {
  const { data, isError, isLoading } = useGetAgentDashboardQuery();
  const assignments = data?.data ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        description="The elections you're assigned to observe, and their live results."
        title="My assignments"
      />

      {isLoading ? (
        <CardGridSkeleton count={3} />
      ) : isError ? (
        <ErrorState />
      ) : assignments.length === 0 ? (
        <EmptyState
          description="When an administrator assigns you to an election, it appears here."
          icon={Eye}
          title="No assignments yet"
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {assignments.map((assignment) => (
            <Card key={assignment.id}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle
                    className="min-w-0 truncate text-base"
                    title={assignment.election.name}
                  >
                    {assignment.election.name}
                  </CardTitle>
                  <StatusBadge status={assignment.election.status} />
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* Candidate names are user text: plain wrapped line, no badge. */}
                <p className="min-w-0 text-xs text-muted-foreground [overflow-wrap:anywhere]">
                  {assignment.candidate
                    ? `Representing ${assignment.candidate.name}`
                    : "General observer"}
                </p>
                <TurnoutStats electionId={assignment.election.id} />
                <LinkButton
                  className="w-full"
                  href={`/results/${assignment.election.slug}`}
                  variant="outline"
                >
                  View results <ArrowUpRight className="size-4" />
                </LinkButton>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
