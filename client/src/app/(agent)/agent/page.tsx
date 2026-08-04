"use client";

// The agent's dashboard: every election they're assigned to observe, who
// they represent there, and a straight path to the live results.
import { ArrowUpRight, Eye } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { LinkButton } from "@/components/ui/link-button";
import { CardGridSkeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState, PageHeader } from "@/components/ui/states";
import { StatusBadge } from "@/components/ui/status-badge";
import { useGetAgentDashboardQuery } from "@/redux/governance-api";

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
                  <CardTitle className="min-w-0 truncate text-base">
                    {assignment.election.name}
                  </CardTitle>
                  <StatusBadge status={assignment.election.status} />
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {assignment.candidate ? (
                  <Badge variant="outline">Representing {assignment.candidate.name}</Badge>
                ) : (
                  <p className="text-xs text-muted-foreground">General observer</p>
                )}
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
