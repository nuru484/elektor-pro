"use client";

import {
  CalendarClock,
  CheckSquare,
  FileClock,
  ListChecks,
  ShieldCheck,
  Users,
  Vote,
} from "lucide-react";
import Link from "next/link";

import { DailyBars } from "@/components/dashboard/daily-bars";
import { MeterList } from "@/components/dashboard/meter-list";
import { StatCard } from "@/components/dashboard/stat-card";
import { Card, CardContent } from "@/components/ui/card";
import { CardGridSkeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/ui/status-badge";
import { ErrorState, PageHeader } from "@/components/ui/states";
import { LinkButton } from "@/components/ui/link-button";
import { useGetDashboardQuery } from "@/redux/admin-api";

/** Lifecycle order for the status board (enum order, not alphabetical). */
const STATUS_ORDER = [
  "DRAFT",
  "SCHEDULED",
  "IN_PROGRESS",
  "PAUSED",
  "ENDED",
  "CANCELLED",
  "ARCHIVED",
];

const statusLabel = (status: string): string => {
  const text = status.replaceAll("_", " ").toLowerCase();
  return text.charAt(0).toUpperCase() + text.slice(1);
};

function SectionCard({
  children,
  title,
}: {
  children: React.ReactNode;
  title: string;
}) {
  // h-full so side-by-side cards in a grid row match heights instead of one
  // trailing short under its neighbour.
  return (
    <Card className="h-full">
      <CardContent className="flex h-full flex-col p-5">
        <h2 className="mb-4 font-medium">{title}</h2>
        <div className="min-h-0 flex-1">{children}</div>
      </CardContent>
    </Card>
  );
}

export default function AdminDashboard() {
  const { data, isError, isLoading } = useGetDashboardQuery();

  const header = (
    <PageHeader
      action={<LinkButton href="/admin/elections" variant="brand">Manage elections</LinkButton>}
      description="An overview of your organization's elections and activity."
      title="Dashboard"
    />
  );

  if (isLoading) {
    return (
      <div className="space-y-8">
        {header}
        <CardGridSkeleton />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="space-y-8">
        {header}
        <ErrorState />
      </div>
    );
  }

  const {
    electionsByStatus,
    needsAttention,
    recentActivity,
    recentElections,
    stats,
    trends,
    turnoutByElection,
    votesSeries,
  } = data.data;

  const attentionTiles = [
    {
      count: needsAttention.pendingChanges,
      href: "/admin/approvals",
      icon: CheckSquare,
      label: "Approvals waiting",
    },
    {
      count: needsAttention.candidatesUnderReview,
      href: "/admin/elections",
      icon: ShieldCheck,
      label: "Candidates in vetting",
    },
    {
      count: needsAttention.electionsStartingSoon,
      href: "/admin/elections",
      icon: CalendarClock,
      label: "Starting within 24h",
    },
    {
      count: needsAttention.electionsEndingSoon,
      href: "/admin/elections",
      icon: CalendarClock,
      label: "Ending within 24h",
    },
    {
      count: needsAttention.unpublishedEndedElections,
      href: "/admin/elections",
      icon: FileClock,
      label: "Results unpublished",
    },
  ];

  const statusRows = [...electionsByStatus]
    .sort(
      (a, b) => STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status),
    )
    .map((row) => ({ label: statusLabel(row.status), value: row.count }));

  return (
    <div className="space-y-8">
      {header}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          hint={`${stats.activeElections} in progress now`}
          icon={Vote}
          label="Elections"
          value={stats.totalElections}
        />
        <StatCard
          icon={Users}
          label="Voters"
          trend={trends.votersRegistered.trend}
          value={stats.totalVoters}
          windowDays={trends.windowDays}
        />
        <StatCard
          icon={ListChecks}
          label="Candidates"
          value={stats.totalCandidates}
        />
        <StatCard
          hint={`last ${trends.windowDays} days`}
          icon={Vote}
          label="Ballots cast"
          trend={trends.ballotsCast.trend}
          value={trends.ballotsCast.current}
          windowDays={trends.windowDays}
        />
        <StatCard
          icon={CheckSquare}
          label="Pending approvals"
          value={stats.pendingChanges}
        />
        <StatCard
          hint="best of recent elections"
          icon={Users}
          label="Top turnout"
          value={
            turnoutByElection.length === 0
              ? "-"
              : `${Math.max(...turnoutByElection.map((e) => e.percentage))}%`
          }
        />
      </div>

      {/* Work queue: each tile links to where the work gets done. */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
        {attentionTiles.map((tile) => (
          <Link
            className={`rounded-xl border p-4 transition-colors hover:border-brand/50 ${
              tile.count > 0 ? "border-border bg-card" : "border-border/60 bg-card/40"
            }`}
            href={tile.href}
            key={tile.label}
          >
            <tile.icon
              aria-hidden
              className={`size-4 ${tile.count > 0 ? "text-brand" : "text-muted-foreground/60"}`}
            />
            <p className="mt-2 text-xl font-semibold tabular-nums">
              {tile.count}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">{tile.label}</p>
          </Link>
        ))}
      </div>

      {/* items-stretch (grid default) plus h-full cards: the votes chart and
          the status board sit on one row, so they should end on one line. */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <SectionCard title="Ballots cast per day">
            <DailyBars series={votesSeries} />
          </SectionCard>
        </div>
        <SectionCard title="Elections by status">
          <MeterList
            ariaLabel="Elections by status"
            emptyText="No elections yet."
            rows={statusRows}
          />
        </SectionCard>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <SectionCard title="Turnout">
          <MeterList
            ariaLabel="Turnout by election"
            emptyText="No open or ended elections yet."
            rows={turnoutByElection.map((election) => ({
              detail: `${election.voted.toLocaleString()} / ${election.eligible.toLocaleString()} · ${election.percentage}%`,
              label: election.name,
              percentage: election.percentage,
              value: election.voted,
            }))}
          />
        </SectionCard>

        <SectionCard title="Recent elections">
          <div className="divide-y divide-border">
            {recentElections.length === 0 && (
              <p className="py-4 text-sm text-muted-foreground">No elections yet.</p>
            )}
            {recentElections.map((e) => (
              <Link
                className="flex items-center justify-between gap-3 py-3 transition-colors hover:text-brand"
                href={`/admin/elections/${e.id}`}
                key={e.id}
                title={`Open ${e.name}`}
              >
                {/* Clamped to one line but linked - the workspace shows
                    the full name; the tooltip carries it on hover. */}
                <span className="min-w-0 [overflow-wrap:anywhere] line-clamp-1 whitespace-normal text-sm font-medium">
                  {e.name}
                </span>
                <StatusBadge status={e.status} />
              </Link>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="Recent activity">
          <div className="space-y-2.5">
            {recentActivity.length === 0 && (
              <p className="py-4 text-sm text-muted-foreground">Nothing yet.</p>
            )}
            {recentActivity.slice(0, 8).map((a) => (
              <div className="flex items-center gap-3 text-sm" key={a.id}>
                <span className="size-1.5 shrink-0 rounded-full bg-brand" />
                <span className="truncate text-muted-foreground">
                  <span className="font-medium text-foreground">{a.action}</span> · {a.entity}
                </span>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
