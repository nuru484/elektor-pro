"use client";

// The candidate console: every election this person contests, their
// portfolio, ballot number, nomination status, vetting progress (their own
// record, panel identities redacted server-side), and the path to results
// once the election's policy allows.
import { ArrowUpRight, Award, ClipboardCheck, ShieldCheck, Users } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import type { MyCandidacy } from "@/types/api";

import {
  ElectionFilterBar,
  EMPTY_ELECTION_FILTER,
  type ElectionFilter,
} from "@/components/console/election-filter-bar";
import { ListPagination } from "@/components/console/list-pagination";
import { ResultsAccessTab } from "@/components/console/results-access";
import { useDebounce } from "@/hooks/use-debounce";
import { CardTitleRow } from "@/components/console/card-title-row";
import { EntityAvatar } from "@/components/console/entity-avatar";
import { PhotoViewerTrigger } from "@/components/console/photo-viewer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { LinkButton } from "@/components/ui/link-button";
import { CardGridSkeleton, Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState, PageHeader } from "@/components/ui/states";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatusBadge } from "@/components/ui/status-badge";
import { useGetCandidateVettingQuery } from "@/redux/admin-api";
import { useGetMyCandidaciesQuery } from "@/redux/voting-api";

/**
 * The candidate's own vetting record: per-criterion averages and the total
 * against the pass mark. Fetched on demand - most candidacies never open it.
 */
function VettingDetails({ candidacy }: { candidacy: MyCandidacy }) {
  const { data, isError, isLoading } = useGetCandidateVettingQuery(candidacy.id);
  const vetting = data?.data;
  if (isLoading) return <Skeleton className="h-16 rounded-lg" />;
  if (isError || !vetting) {
    return (
      <p className="text-xs text-muted-foreground">
        Vetting details are not available yet.
      </p>
    );
  }
  const percent =
    vetting.maxTotal > 0 ? Number(((vetting.total / vetting.maxTotal) * 100).toFixed(1)) : 0;
  return (
    <div className="space-y-1.5 rounded-lg border border-border bg-muted/30 p-3">
      {vetting.byCriterion.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          The panel has not defined criteria yet.
        </p>
      ) : (
        <>
          {vetting.byCriterion.map((entry) => (
            <div
              className="flex items-baseline justify-between gap-3 text-xs"
              key={entry.criterion.id}
            >
              <span className="min-w-0 [overflow-wrap:anywhere]">
                {entry.criterion.name}
              </span>
              <span className="shrink-0 font-mono tabular-nums">
                {entry.average ?? "not scored"} / {entry.criterion.maxScore}
              </span>
            </div>
          ))}
          <div className="flex items-baseline justify-between gap-3 border-t border-border pt-1.5 text-xs font-semibold">
            <span>Total</span>
            <span className="font-mono tabular-nums">
              {vetting.total} / {vetting.maxTotal} ({percent}%)
            </span>
          </div>
          {/* Score meter, with the pass mark as a tick so "how close am I"
              is readable at a glance. */}
          <div className="relative">
            <div
              aria-label={`Vetting score ${percent}%`}
              aria-valuemax={100}
              aria-valuemin={0}
              aria-valuenow={Math.round(percent)}
              className="h-1.5 overflow-hidden rounded-full bg-muted"
              role="progressbar"
            >
              <div
                className="h-full rounded-full bg-chart-1"
                style={{ width: `${Math.min(percent, 100)}%` }}
              />
            </div>
            {candidacy.election.vettingPassPercent != null && (
              <span
                aria-hidden
                className="absolute -top-0.5 h-2.5 w-0.5 rounded-full bg-foreground/60"
                style={{ left: `${Math.min(candidacy.election.vettingPassPercent, 100)}%` }}
              />
            )}
          </div>
          {candidacy.election.vettingPassPercent != null && (
            <p className="text-[11px] text-muted-foreground">
              Pass mark: {candidacy.election.vettingPassPercent}%
            </p>
          )}
        </>
      )}
    </div>
  );
}

function CandidacyCard({ candidacy }: { candidacy: MyCandidacy }) {
  const [showVetting, setShowVetting] = useState(false);
  const election = candidacy.election;
  const resultsOpen =
    election.resultsPublishedAt !== null ||
    election.resultsPolicy === "LIVE" ||
    (election.resultsPolicy === "ON_CLOSE" &&
      (election.status === "ENDED" || election.status === "ARCHIVED"));

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitleRow
          tag={<StatusBadge status={election.status} />}
          title={election.name}
        />
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <PhotoViewerTrigger name={candidacy.name} url={candidacy.profilePicture}>
            <EntityAvatar name={candidacy.name} size="size-10" url={candidacy.profilePicture} />
          </PhotoViewerTrigger>
          <div className="min-w-0">
            {/* Portfolio and nickname are user text: plain wrapped lines. */}
            <p className="min-w-0 text-sm font-medium [overflow-wrap:anywhere]">
              {candidacy.portfolio.name}
            </p>
            <p className="min-w-0 text-xs text-muted-foreground [overflow-wrap:anywhere]">
              {candidacy.ballotNumber != null
                ? `Ballot number ${String(candidacy.ballotNumber)}`
                : "Ballot number not assigned yet"}
              {candidacy.nickname ? ` · ${candidacy.nickname}` : ""}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <StatusBadge status={candidacy.status} />
          {candidacy.vettingNote && (
            <span
              className="min-w-0 text-xs text-muted-foreground [overflow-wrap:anywhere]"
              title="The vetting panel's decision note"
            >
              {candidacy.vettingNote}
            </span>
          )}
        </div>

        {/* The field: everyone contesting the same portfolio. */}
        {(candidacy.portfolio.candidates?.filter((c) => c.id !== candidacy.id).length ??
          0) > 0 && (
          <div className="rounded-lg border border-border bg-muted/30 p-3">
            <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <Users className="size-3.5" /> Also contesting {candidacy.portfolio.name}
            </p>
            <ul className="mt-2 max-h-40 space-y-1.5 overflow-y-auto">
              {(candidacy.portfolio.candidates ?? [])
                .filter((c) => c.id !== candidacy.id)
                .map((rival) => (
                  <li className="flex min-w-0 items-center gap-2" key={rival.id}>
                    <PhotoViewerTrigger name={rival.name} url={rival.profilePicture}>
                      <EntityAvatar
                        name={rival.name}
                        size="size-6"
                        url={rival.profilePicture}
                      />
                    </PhotoViewerTrigger>
                    <span className="min-w-0 flex-1 truncate text-xs">
                      {rival.ballotNumber != null && (
                        <span className="mr-1 font-mono text-muted-foreground">
                          {rival.ballotNumber}.
                        </span>
                      )}
                      {rival.name}
                    </span>
                    <span className="shrink-0">
                      <StatusBadge status={rival.status} />
                    </span>
                  </li>
                ))}
            </ul>
          </div>
        )}

        {election.vettingEnabled && (
          <div>
            <Button
              onClick={() => {
                setShowVetting((prev) => !prev);
              }}
              size="sm"
              title="Your own scores; panel identities are never shown"
              variant="outline"
            >
              <ClipboardCheck className="size-4" />
              {showVetting ? "Hide vetting scores" : "My vetting scores"}
            </Button>
            {showVetting && (
              <div className="mt-2">
                <VettingDetails candidacy={candidacy} />
              </div>
            )}
          </div>
        )}

        {resultsOpen ? (
          <LinkButton
            className="w-full"
            href={`/results/${election.slug}`}
            title="Open this election's results page"
            variant="outline"
          >
            View results <ArrowUpRight className="size-4" />
          </LinkButton>
        ) : (
          <Button
            className="w-full"
            disabled
            title="Results open according to the election's results policy"
            variant="outline"
          >
            Results not yet released
          </Button>
        )}
        <Link
          className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
          href={`/results/${election.slug}/verify`}
          title="Re-run the ballot-chain check or verify any receipt for this election"
        >
          <ShieldCheck className="size-3.5" /> Verify receipts and ballot integrity
        </Link>
      </CardContent>
    </Card>
  );
}

export default function CandidateDashboardPage() {
  const [filter, setFilter] = useState<ElectionFilter>(EMPTY_ELECTION_FILTER);
  const [page, setPage] = useState(1);
  const search = useDebounce(filter.search.trim(), 400);
  const { data, isError, isLoading } = useGetMyCandidaciesQuery({
    from: filter.from || undefined,
    limit: 9,
    page,
    search: search || undefined,
    to: filter.to || undefined,
  });
  const candidacies = data?.data ?? [];
  const filtered = Boolean(filter.search || filter.from || filter.to);
  // The filter bar is only meaningful once there is something to filter. On
  // an unfiltered empty console it is pure noise, so it is not rendered.
  const showFilters = candidacies.length > 0 || filtered;

  return (
    <div className="space-y-6">
      <PageHeader
        description="Your nominations: status, vetting, ballot numbers, and results."
        title="My candidacies"
      />

      <Tabs className="gap-4" defaultValue="candidacies">
        <TabsList>
          <TabsTrigger value="candidacies">Candidacies</TabsTrigger>
          <TabsTrigger value="results">Results</TabsTrigger>
        </TabsList>

        <TabsContent className="space-y-4" value="candidacies">
          {showFilters && (
            <ElectionFilterBar
              filter={filter}
              onChange={(next) => {
                setFilter(next);
                setPage(1);
              }}
            />
          )}

          {isLoading ? (
            <CardGridSkeleton count={3} />
          ) : isError ? (
            <ErrorState />
          ) : candidacies.length === 0 ? (
            <EmptyState
              description={
                filtered
                  ? "No candidacy matches your search or period. Clear the filters to see everything."
                  : "When you are nominated for a portfolio, your candidacy appears here with its vetting progress and results."
              }
              icon={Award}
              title={filtered ? "No matches" : "No candidacies yet"}
            />
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {candidacies.map((candidacy) => (
                  <CandidacyCard candidacy={candidacy} key={candidacy.id} />
                ))}
              </div>
              <ListPagination meta={data?.meta} onPageChange={setPage} />
            </>
          )}
        </TabsContent>

        <TabsContent value="results">
          <ResultsAccessTab
            elections={candidacies.map((candidacy) => candidacy.election)}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
