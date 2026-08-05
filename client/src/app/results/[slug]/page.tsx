"use client";

import {
  ArrowLeft,
  Crown,
  LayoutGrid,
  Lock,
  Radio,
  Rows3,
  ShieldCheck,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { use, useState } from "react";

import { EntityAvatar } from "@/components/console/entity-avatar";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/states";
import { cn } from "@/lib/utils";
import { getApiErrorMessage } from "@/utils/extract-api-error";
import { initialsOf } from "@/utils/format-date";
import { useElectionSocket } from "@/hooks/use-election-socket";
import { useGetResultsQuery } from "@/redux/voting-api";
import type { PortfolioResult } from "@/types/api";

const fmt = (n: number) => n.toLocaleString();

/**
 * Photo-first result tile, portrait-shaped: a SQUARE photo fills the card's
 * full width (roughly the top 45% of its height), with the name, votes, and
 * percent stacked in the space below. Tiles flow left to right and wrap
 * early on narrow screens.
 */
function CandidateTile({
  candidate,
  leading,
}: {
  candidate: PortfolioResult["candidates"][number];
  leading: boolean;
}) {
  return (
    <div
      className={cn(
        "flex min-w-0 flex-col overflow-hidden rounded-lg border text-center",
        leading ? "border-brand bg-brand-muted/40" : "border-border",
      )}
      title={`${candidate.name}: ${fmt(candidate.votes)} votes (${candidate.percentage}%)`}
    >
      {/* Full-bleed square photo - the card's top block. */}
      <div className="relative aspect-square w-full overflow-hidden">
        {candidate.profilePicture ? (
          // eslint-disable-next-line @next/next/no-img-element -- external avatar
          <img
            alt={candidate.name}
            className="size-full object-cover"
            src={candidate.profilePicture}
          />
        ) : (
          <div className="grid size-full place-items-center bg-brand text-2xl font-semibold text-brand-foreground">
            {initialsOf(candidate.name)}
          </div>
        )}
        {leading && (
          <span className="absolute top-1.5 right-1.5 grid size-6 place-items-center rounded-full bg-background/90">
            <Crown className="size-3.5 text-warning" />
          </span>
        )}
      </div>
      {/* The text block below the photo. */}
      <div className="flex min-w-0 flex-1 flex-col items-center gap-0.5 px-2 py-2.5">
        <span className="min-w-0 max-w-full text-sm font-medium whitespace-normal [overflow-wrap:anywhere]">
          {candidate.ballotNumber != null && (
            <span className="mr-1 font-mono text-xs text-muted-foreground">
              {candidate.ballotNumber}.
            </span>
          )}
          {candidate.name}
        </span>
        <span className="mt-auto pt-1 font-mono text-sm font-semibold tabular-nums">
          {fmt(candidate.votes)} {candidate.votes === 1 ? "vote" : "votes"}
        </span>
        <span className="font-mono text-xs tabular-nums text-muted-foreground">
          {candidate.percentage}%
        </span>
      </div>
    </div>
  );
}

function PortfolioCard({
  portfolio,
  view,
}: {
  portfolio: PortfolioResult;
  view: "grid" | "list";
}) {
  const max = Math.max(1, ...portfolio.candidates.map((c) => c.votes));
  const isYesNo = portfolio.votingMethod === "YES_NO";
  return (
    <Card>
      <CardContent className="space-y-4 p-5">
        {/* Long portfolio names own the full width and wrap; the vote count
            moves under them on phones instead of squeezing the title. */}
        <div className="flex flex-col gap-0.5 min-[480px]:flex-row min-[480px]:items-baseline min-[480px]:justify-between min-[480px]:gap-3">
          <h3 className="min-w-0 font-semibold [overflow-wrap:anywhere]">
            {portfolio.name}
          </h3>
          <span className="shrink-0 font-mono text-xs tabular-nums text-muted-foreground">
            {fmt(portfolio.totalVotes)} votes
          </span>
        </div>
        {view === "grid" && !isYesNo ? (
          <div className="grid grid-cols-2 gap-2 min-[480px]:grid-cols-3 sm:grid-cols-4">
            {portfolio.candidates.map((c) => (
              <CandidateTile
                candidate={c}
                key={c.id}
                leading={portfolio.winner?.id === c.id && c.votes > 0}
              />
            ))}
          </div>
        ) : (
        <div className="space-y-3">
          {portfolio.candidates.map((c) => {
            const leading = portfolio.winner?.id === c.id && c.votes > 0;
            return (
              <div key={c.id}>
                {/* The name wraps freely; the figures are the primary number
                    and never truncate (flex-none). */}
                <div className="mb-1 flex items-start justify-between gap-3 text-sm">
                  <span className="flex min-w-0 flex-1 items-start gap-2 font-medium">
                    <EntityAvatar name={c.name} size="size-8" url={c.profilePicture} />
                    {leading && (
                      <Crown className="mt-0.5 size-3.5 shrink-0 text-warning" />
                    )}
                    <span className="min-w-0 [overflow-wrap:anywhere]">
                      {c.ballotNumber != null && (
                        <span className="mr-1 font-mono text-xs text-muted-foreground">
                          {c.ballotNumber}.
                        </span>
                      )}
                      {c.name}
                      {c.nickname && (
                        <span className="ml-1.5 text-xs font-normal text-muted-foreground [overflow-wrap:anywhere]">
                          {c.nickname}
                        </span>
                      )}
                    </span>
                  </span>
                  {/* The figures are the point of this page: a prominent
                      two-line number block that never truncates. */}
                  <span className="flex-none text-right">
                    <span className="block font-mono text-sm font-semibold tabular-nums">
                      {c.percentage}%
                    </span>
                    <span className="block font-mono text-xs tabular-nums text-muted-foreground">
                      {fmt(c.votes)} {c.votes === 1 ? "vote" : "votes"}
                    </span>
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className={cn("h-full rounded-full transition-all", leading ? "bg-brand" : "bg-muted-foreground/40")}
                    style={{ width: `${(c.votes / max) * 100}%` }}
                  />
                </div>
                {isYesNo && (
                  <p className="mt-1 font-mono text-xs tabular-nums text-muted-foreground">
                    <span className="text-success">Yes {fmt(c.approveVotes ?? 0)}</span>
                    {" · "}
                    <span className="text-destructive">No {fmt(c.rejectVotes ?? 0)}</span>
                  </p>
                )}
              </div>
            );
          })}
        </div>
        )}
        {(portfolio.abstain > 0 || portfolio.skip > 0) && (
          <p className="border-t border-border pt-3 font-mono text-xs tabular-nums text-muted-foreground">
            {portfolio.abstain > 0 ? `Abstained ${fmt(portfolio.abstain)}` : ""}
            {portfolio.abstain > 0 && portfolio.skip > 0 ? " · " : ""}
            {portfolio.skip > 0 ? `Skipped ${fmt(portfolio.skip)}` : ""}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Back to wherever the viewer came from (console, voter portal, a share);
 * with no in-tab history (a direct link) it falls back to the home page.
 */
function BackControl() {
  const router = useRouter();
  return (
    <button
      className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
      onClick={() => {
        if (window.history.length > 1) router.back();
        else router.push("/");
      }}
      type="button"
    >
      <ArrowLeft className="size-4" /> Back
    </button>
  );
}

export default function ResultsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const { data, error, isLoading, refetch } = useGetResultsQuery(slug);
  const { connected } = useElectionSocket(data?.data.election.id, refetch);
  // Viewers pick their layout; the choice sticks on this device. Lazy init
  // reads localStorage once on the client (never during SSR).
  const [view, setView] = useState<"grid" | "list">(() => {
    if (typeof window === "undefined") return "list";
    const saved = window.localStorage.getItem("results-view");
    return saved === "grid" ? "grid" : "list";
  });
  const switchView = (next: "grid" | "list") => {
    setView(next);
    window.localStorage.setItem("results-view", next);
  };

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
        action={
          status === 403 ? (
            <Link
              className="text-sm font-medium text-brand hover:underline"
              href={`/results/${slug}/verify`}
              title="Integrity checks stay open even while results are hidden"
            >
              Verify election integrity instead
            </Link>
          ) : undefined
        }
        description={
          status === 403
            ? "Results for this election aren't available to the public yet. The organisers release them according to the election's results policy."
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
        <div className="min-w-0">
          <BackControl />
          <p className="mt-3 font-mono text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">
            Election results
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <h1 className="min-w-0 text-2xl font-semibold [overflow-wrap:anywhere] sm:text-3xl">
              {election.name}
            </h1>
            {election.status === "IN_PROGRESS" && connected && (
              <Badge title="Updating in real time" variant="success">
                <Radio className="size-3 animate-pulse" /> Live
              </Badge>
            )}
            {election.certifiedAt && (
              <Badge
                title="These results are certified: snapshotted, fingerprinted, and locked"
                variant="brand"
              >
                Certified
              </Badge>
            )}
          </div>
          <Link
            className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
            href={`/results/${election.slug}/verify`}
            title="Re-run the ballot-chain check or verify your own receipt"
          >
            <ShieldCheck className="size-3.5" /> Verify this election&apos;s integrity
          </Link>
        </div>
      </div>

      {/* The headline numbers: large, mono, thousands-separated. */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-border bg-card px-3 py-3 sm:px-4">
          <p className="text-[11px] font-medium text-muted-foreground sm:text-xs">
            Votes cast
          </p>
          <p className="mt-0.5 font-mono text-xl font-semibold tabular-nums sm:text-2xl">
            {fmt(turnout.totalVoted)}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card px-3 py-3 sm:px-4">
          <p className="text-[11px] font-medium text-muted-foreground sm:text-xs">
            Eligible voters
          </p>
          <p className="mt-0.5 font-mono text-xl font-semibold tabular-nums sm:text-2xl">
            {fmt(turnout.totalEligible)}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card px-3 py-3 sm:px-4">
          <p className="text-[11px] font-medium text-muted-foreground sm:text-xs">
            Turnout
          </p>
          <p className="mt-0.5 font-mono text-xl font-semibold tabular-nums sm:text-2xl">
            {turnout.percentage}%
          </p>
        </div>
      </div>

      <Card>
        <CardContent className="p-5">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">Turnout</span>
            <span className="tabular-nums text-muted-foreground">
              {fmt(turnout.totalVoted)} of {fmt(turnout.totalEligible)} · {turnout.percentage}%
            </span>
          </div>
          <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-brand transition-all" style={{ width: `${turnout.percentage}%` }} />
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-end gap-1">
        <span className="mr-1 text-xs text-muted-foreground">View</span>
        <button
          className={cn(
            "inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-medium transition-colors",
            view === "list"
              ? "border-brand bg-brand-muted text-foreground"
              : "border-border text-muted-foreground hover:text-foreground",
          )}
          onClick={() => {
            switchView("list");
          }}
          title="Rows with photos and vote bars"
          type="button"
        >
          <Rows3 className="size-3.5" /> List
        </button>
        <button
          className={cn(
            "inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-medium transition-colors",
            view === "grid"
              ? "border-brand bg-brand-muted text-foreground"
              : "border-border text-muted-foreground hover:text-foreground",
          )}
          onClick={() => {
            switchView("grid");
          }}
          title="Photo cards side by side"
          type="button"
        >
          <LayoutGrid className="size-3.5" /> Cards
        </button>
      </div>

      <div className="grid gap-4">
        {portfolios.map((p) => (
          <PortfolioCard key={p.id} portfolio={p} view={view} />
        ))}
      </div>
    </div>
  );
}
