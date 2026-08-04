"use client";

import { CheckSquare, ListChecks, Users, Vote } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { CardGridSkeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/ui/status-badge";
import { ErrorState, PageHeader } from "@/components/ui/states";
import { LinkButton } from "@/components/ui/link-button";
import { useGetDashboardQuery } from "@/redux/admin-api";

const STAT_CARDS = [
  { icon: Vote, key: "totalElections" as const, label: "Elections" },
  { icon: ListChecks, key: "totalCandidates" as const, label: "Candidates" },
  { icon: Users, key: "totalVoters" as const, label: "Voters" },
  { icon: CheckSquare, key: "pendingChanges" as const, label: "Pending approvals" },
];

export default function AdminDashboard() {
  const { data, isError, isLoading } = useGetDashboardQuery();

  return (
    <div className="space-y-8">
      <PageHeader
        action={<LinkButton href="/admin/elections" variant="brand">Manage elections</LinkButton>}
        description="An overview of your organization's elections and activity."
        title="Dashboard"
      />

      {isLoading ? (
        <CardGridSkeleton />
      ) : isError || !data ? (
        <ErrorState />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {STAT_CARDS.map((c) => (
              <Card key={c.key}>
                <CardContent className="flex items-center justify-between p-5">
                  <div>
                    <p className="text-sm text-muted-foreground">{c.label}</p>
                    <p className="mt-1 text-2xl font-semibold tabular-nums">
                      {data.data.stats[c.key]}
                    </p>
                  </div>
                  <c.icon className="size-5 text-brand" />
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardContent className="p-5">
                <h2 className="mb-3 font-medium">Recent elections</h2>
                <div className="divide-y divide-border">
                  {data.data.recentElections.length === 0 && (
                    <p className="py-4 text-sm text-muted-foreground">No elections yet.</p>
                  )}
                  {data.data.recentElections.map((e) => (
                    <div className="flex items-center justify-between gap-3 py-3" key={e.id}>
                      <span className="truncate text-sm font-medium">{e.name}</span>
                      <StatusBadge status={e.status} />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-5">
                <h2 className="mb-3 font-medium">Recent activity</h2>
                <div className="space-y-2.5">
                  {data.data.recentActivity.slice(0, 8).map((a) => (
                    <div className="flex items-center gap-3 text-sm" key={a.id}>
                      <span className="size-1.5 shrink-0 rounded-full bg-brand" />
                      <span className="truncate text-muted-foreground">
                        <span className="font-medium text-foreground">{a.action}</span> · {a.entity}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
