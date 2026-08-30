"use client";

// The election workspace: one election managed from the inside. A shared
// header (name, status, window, status control) sits above path-based tabs -
// Overview, Portfolios, Candidates, Voters, Results, Settings - so each area
// is a real URL and the sidebar stays lean.
import { ExternalLink, Lock } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { use } from "react";

import { ElectionStatusControl } from "@/components/elections/status-control";
import { BackButton } from "@/components/ui/back-button";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/states";
import { StatusBadge } from "@/components/ui/status-badge";
import { cn } from "@/lib/utils";
import { useGetElectionQuery } from "@/redux/admin-api";
import { getApiErrorMessage } from "@/utils/extract-api-error";
import { formatDate } from "@/utils/format-date";

const TABS = [
  { label: "Overview", segment: "" },
  { label: "Portfolios", segment: "portfolios" },
  { label: "Candidates", segment: "candidates" },
  { label: "Vetting", segment: "vetting" },
  { label: "Voters", segment: "voters" },
  { label: "Results", segment: "results" },
  { label: "Settings", segment: "settings" },
] as const;

function WorkspaceTabs({ electionId }: { electionId: string }) {
  const pathname = usePathname();
  const base = `/admin/elections/${electionId}`;
  const activeSegment = pathname === base ? "" : (pathname.slice(base.length + 1).split("/")[0] ?? "");

  return (
    <nav
      aria-label="Election sections"
      className="-mx-4 overflow-x-auto border-b border-border px-4 sm:mx-0 sm:px-0"
    >
      <div className="flex gap-1">
        {TABS.map((tab) => {
          const active = activeSegment === tab.segment;
          return (
            <Link
              aria-current={active ? "page" : undefined}
              className={cn(
                "-mb-px whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium transition-colors",
                active
                  ? "border-brand text-foreground"
                  : "border-transparent text-muted-foreground hover:border-border hover:text-foreground",
              )}
              href={tab.segment ? `${base}/${tab.segment}` : base}
              key={tab.segment}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

function WorkspaceHeaderSkeleton() {
  return (
    <div className="space-y-3">
      <Skeleton className="h-7 w-2/3 max-w-md" />
      <Skeleton className="h-4 w-1/2 max-w-xs" />
    </div>
  );
}

export default function ElectionWorkspaceLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { data, error, isError, isLoading } = useGetElectionQuery(id);
  const election = data?.data;

  return (
    <div className="space-y-5">
      {isLoading && <WorkspaceHeaderSkeleton />}
      {isError && <ErrorState message={getApiErrorMessage(error, "Could not load this election")} />}
      {election && (
        // The heading and the identity line own the full width (long names
        // wrap over every column); status + actions sit on their own row
        // beneath them.
        <div className="space-y-3">
          <div className="min-w-0 space-y-1">
            <div className="flex min-w-0 items-center gap-1.5">
              <BackButton href="/admin/elections" label="Back to elections" />
              <h1 className="min-w-0 text-xl font-semibold sm:text-2xl">
                Election workspace
              </h1>
            </div>
            <p className="min-w-0 text-sm text-muted-foreground [overflow-wrap:anywhere]">
              <span className="font-medium text-foreground">{election.name}</span>
              {" · "}
              <span className="font-mono text-xs">{election.slug}</span>
              {" · "}
              {formatDate(election.startDate)} –{" "}
              {formatDate(election.endDate)}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={election.status} />
            {election.isLocked && (
              <span
                className="inline-flex items-center gap-1 text-xs text-muted-foreground"
                title="Results are certified; content is locked against changes"
              >
                <Lock className="size-3.5" /> Certified
              </span>
            )}
            <span className="ml-auto flex flex-wrap items-center gap-2">
              <ElectionStatusControl className="h-9 w-auto text-xs" election={election} />
              <Link
                className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
                href={`/results/${election.slug}`}
                title="Open the results page voters and the public see"
              >
                <ExternalLink className="size-3.5" /> Public results
              </Link>
            </span>
          </div>
        </div>
      )}

      <WorkspaceTabs electionId={id} />

      <div>{children}</div>
    </div>
  );
}
