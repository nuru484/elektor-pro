"use client";

import { ArrowLeft, CheckCircle2, Copy, Eye, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { use, useState } from "react";
import { toast } from "sonner";

import { EntityAvatar } from "@/components/console/entity-avatar";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import { LinkButton } from "@/components/ui/link-button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { cn } from "@/lib/utils";
import { getApiErrorMessage } from "@/utils/extract-api-error";
import { VoterChrome } from "@/components/vote/voter-header";
import { useCastBallotMutation, useGetVoterBallotQuery } from "@/redux/voting-api";

type Selection = { approve?: boolean; candidateIds: string[]; type: "ABSTAIN" | "VOTE" };

function BallotBody({ electionId }: { electionId: string }) {
  const { data, isError, isLoading } = useGetVoterBallotQuery(electionId);
  const [cast, { isLoading: casting }] = useCastBallotMutation();
  const [selections, setSelections] = useState<Record<string, Selection>>({});
  const [receipt, setReceipt] = useState<null | string>(null);
  const [reviewing, setReviewing] = useState(false);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-48 w-full rounded-xl" />
        <Skeleton className="h-48 w-full rounded-xl" />
      </div>
    );
  }
  if (isError || !data) return <ErrorState message="Could not load your ballot." />;

  const ballot = data.data;

  if (receipt) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
          <span className="flex size-12 items-center justify-center rounded-full bg-success/12 text-success">
            <CheckCircle2 className="size-6" />
          </span>
          <div>
            <h1 className="text-xl font-semibold">Your vote is recorded</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Keep this receipt code to verify your vote was counted.
            </p>
          </div>
          <button
            className="flex items-center gap-2 rounded-lg border border-border bg-muted px-4 py-2 font-mono text-sm"
            onClick={() => {
              void navigator.clipboard.writeText(receipt);
              toast.success("Receipt copied");
            }}
            type="button"
          >
            {receipt} <Copy className="size-3.5 text-muted-foreground" />
          </button>
          <LinkButton href="/vote" variant="outline">
            Back to my elections
          </LinkButton>
        </CardContent>
      </Card>
    );
  }

  if (ballot.hasVoted) {
    return (
      <EmptyState
        description="Our records show you have already cast a ballot in this election."
        icon={ShieldCheck}
        title="You have already voted"
      />
    );
  }

  if (ballot.accreditationRequired && !ballot.accredited) {
    return (
      <EmptyState
        description="An official must accredit you before you can vote in this election."
        icon={ShieldCheck}
        title="Accreditation required"
      />
    );
  }

  const setSingle = (portfolioId: string, candidateId: string) =>
    setSelections((s) => ({ ...s, [portfolioId]: { candidateIds: [candidateId], type: "VOTE" } }));

  const toggleMulti = (portfolioId: string, candidateId: string, max: number) =>
    setSelections((s) => {
      const current = s[portfolioId]?.candidateIds ?? [];
      const next = current.includes(candidateId)
        ? current.filter((id) => id !== candidateId)
        : current.length < max
          ? [...current, candidateId]
          : current;
      return { ...s, [portfolioId]: { candidateIds: next, type: "VOTE" } };
    });

  const setYesNo = (portfolioId: string, candidateId: string, approve: boolean) =>
    setSelections((s) => ({ ...s, [portfolioId]: { approve, candidateIds: [candidateId], type: "VOTE" } }));

  const setAbstain = (portfolioId: string) =>
    setSelections((s) => ({ ...s, [portfolioId]: { candidateIds: [], type: "ABSTAIN" } }));

  const allAnswered = ballot.portfolios.every((p) => selections[p.id]);

  const submit = async () => {
    setReviewing(false);
    try {
      const payload = ballot.portfolios.map((p) => {
        const sel = selections[p.id]!;
        return {
          approve: sel.approve,
          candidateIds: sel.candidateIds,
          portfolioId: p.id,
          type: sel.type,
        };
      });
      const res = await cast({ electionId, selections: payload }).unwrap();
      setReceipt(res.data.receiptCode);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Could not record your vote"));
    }
  };

  // The admin chooses how candidates are presented: a vertical list, or
  // horizontal cards side by side.
  const gridLayout = ballot.election.settings?.ballotLayout === "grid";

  return (
    <div className="space-y-6">
      <div>
        <Link
          className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          href="/vote"
          title="Back to your elections"
        >
          <ArrowLeft className="size-4" /> Back to my elections
        </Link>
        <h1 className="mt-3 min-w-0 text-xl font-semibold [overflow-wrap:anywhere] sm:text-2xl">
          {ballot.election.name}
        </h1>
        {/*
          The voter is told which kind of election this is BEFORE they cast.
          An open ballot is a legitimate choice for a board or committee vote,
          but only if the people voting know that is what they are in.
        */}
        {ballot.voteVisibleToVoter ? (
          <p className="mt-2 flex items-start gap-2 rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm">
            <Eye className="mt-0.5 size-4 shrink-0 text-warning" />
            <span className="min-w-0">
              <strong className="font-semibold">This is an open ballot.</strong>{" "}
              What you vote is recorded against your name so you can review it
              later. It is not secret.
            </span>
          </p>
        ) : (
          <p className="mt-2 flex items-start gap-2 text-sm text-muted-foreground">
            <ShieldCheck className="mt-0.5 size-4 shrink-0" />
            <span className="min-w-0">
              Make a choice for each position, then submit. Your ballot is
              secret: nothing records how you voted, so keep your receipt code
              to check it was counted.
            </span>
          </p>
        )}
      </div>

      {ballot.portfolios.map((p) => {
        const sel = selections[p.id];
        return (
          <Card key={p.id}>
            <CardHeader>
              <CardTitle className="flex items-center justify-between text-base">
                {p.name}
                <span className="text-xs font-normal text-muted-foreground">
                  {p.votingMethod === "MULTI_SELECT"
                    ? `Choose up to ${p.maxSelections}`
                    : p.votingMethod === "YES_NO"
                      ? "Approve or reject"
                      : "Choose one"}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {p.votingMethod === "YES_NO"
                ? p.candidates.map((c) => (
                    <div
                      className="flex flex-col gap-2 rounded-lg border border-border p-3 min-[420px]:flex-row min-[420px]:items-center min-[420px]:justify-between"
                      key={c.id}
                    >
                      <span className="flex min-w-0 items-center gap-2.5">
                        <EntityAvatar
                          name={c.name}
                          size="size-9"
                          url={c.profilePicture}
                        />
                        <span className="min-w-0 font-medium [overflow-wrap:anywhere]">
                          {c.name}
                        </span>
                      </span>
                      <div className="flex shrink-0 gap-2">
                        {[true, false].map((approve) => (
                          <button
                            className={cn(
                              "rounded-md border px-4 py-1.5 text-sm font-medium transition-colors",
                              sel?.approve === approve
                                ? approve
                                  ? "border-success bg-success/10 text-success"
                                  : "border-destructive bg-destructive/10 text-destructive"
                                : "border-border hover:bg-accent",
                            )}
                            key={String(approve)}
                            onClick={() => setYesNo(p.id, c.id, approve)}
                            type="button"
                          >
                            {approve ? "Yes" : "No"}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))
                : (
                    <div
                      className={cn(
                        gridLayout
                          ? "grid grid-cols-2 gap-2 min-[480px]:grid-cols-3"
                          : "space-y-2",
                      )}
                    >
                      {p.candidates.map((c) => {
                        const chosen = sel?.candidateIds.includes(c.id);
                        const pickIt = () =>
                          p.votingMethod === "MULTI_SELECT"
                            ? toggleMulti(p.id, c.id, p.maxSelections)
                            : setSingle(p.id, c.id);
                        return gridLayout ? (
                          // Horizontal cards: photo on top, name below.
                          <button
                            className={cn(
                              "flex w-full flex-col items-center gap-2 rounded-lg border p-3 text-center transition-colors",
                              chosen
                                ? "border-brand bg-brand-muted"
                                : "border-border hover:bg-accent",
                            )}
                            key={c.id}
                            onClick={pickIt}
                            type="button"
                          >
                            <EntityAvatar
                              name={c.name}
                              size="size-16"
                              url={c.profilePicture}
                            />
                            <span className="min-w-0 max-w-full">
                              <span className="block min-w-0 text-sm font-medium whitespace-normal [overflow-wrap:anywhere]">
                                {c.ballotNumber != null && (
                                  <span className="mr-1 font-mono text-xs text-muted-foreground">
                                    {c.ballotNumber}.
                                  </span>
                                )}
                                {c.name}
                              </span>
                              {c.nickname && (
                                <span className="block min-w-0 text-xs text-muted-foreground [overflow-wrap:anywhere]">
                                  {c.nickname}
                                </span>
                              )}
                            </span>
                            <span
                              className={cn(
                                "flex size-5 shrink-0 items-center justify-center rounded-full border",
                                chosen
                                  ? "border-brand bg-brand text-brand-foreground"
                                  : "border-muted-foreground/40",
                              )}
                            >
                              {chosen && <CheckCircle2 className="size-3.5" />}
                            </span>
                          </button>
                        ) : (
                          // Vertical list: photo beside the name.
                          <button
                            className={cn(
                              "flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors",
                              chosen
                                ? "border-brand bg-brand-muted"
                                : "border-border hover:bg-accent",
                            )}
                            key={c.id}
                            onClick={pickIt}
                            type="button"
                          >
                            <span
                              className={cn(
                                "flex size-5 shrink-0 items-center justify-center rounded-full border",
                                chosen
                                  ? "border-brand bg-brand text-brand-foreground"
                                  : "border-muted-foreground/40",
                              )}
                            >
                              {chosen && <CheckCircle2 className="size-3.5" />}
                            </span>
                            <EntityAvatar
                              name={c.name}
                              size="size-10"
                              url={c.profilePicture}
                            />
                            <span className="min-w-0">
                              <span className="block truncate font-medium">
                                {c.ballotNumber != null && (
                                  <span className="mr-1.5 font-mono text-xs text-muted-foreground">
                                    {c.ballotNumber}.
                                  </span>
                                )}
                                {c.name}
                              </span>
                              {c.nickname && (
                                <span className="block truncate text-xs text-muted-foreground">
                                  {c.nickname}
                                </span>
                              )}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
              <button
                className={cn(
                  "w-full rounded-lg border border-dashed p-2.5 text-sm transition-colors",
                  sel?.type === "ABSTAIN" ? "border-foreground bg-accent" : "border-border text-muted-foreground hover:bg-accent",
                )}
                onClick={() => setAbstain(p.id)}
                type="button"
              >
                Abstain / skip this position
              </button>
            </CardContent>
          </Card>
        );
      })}

      <div className="sticky bottom-4 flex items-center justify-between gap-3 rounded-xl border border-border bg-background/95 p-3 backdrop-blur">
        <span className="text-sm text-muted-foreground">
          {Object.keys(selections).length}/{ballot.portfolios.length} answered
        </span>
        <Button
          disabled={!allAnswered}
          onClick={() => {
            setReviewing(true);
          }}
          title="Review your choices before they are recorded"
          variant="brand"
        >
          Review and submit
        </Button>
      </div>

      {/* One last look: exactly who they are voting for, before it counts. */}
      <Modal
        description="Check every choice below. Once submitted, your ballot is final and cannot be changed."
        onClose={() => {
          setReviewing(false);
        }}
        open={reviewing}
        title="Confirm your ballot"
      >
        <div className="space-y-4">
          <ul className="space-y-2">
            {ballot.portfolios.map((p) => {
              const sel = selections[p.id];
              const chosen = p.candidates.filter((c) =>
                sel?.candidateIds.includes(c.id),
              );
              return (
                <li className="rounded-lg border border-border p-3" key={p.id}>
                  <p className="min-w-0 text-xs font-medium text-muted-foreground [overflow-wrap:anywhere]">
                    {p.name}
                  </p>
                  {sel?.type === "ABSTAIN" ? (
                    <p className="mt-1 text-sm">Abstain / skip this position</p>
                  ) : (
                    chosen.map((c) => (
                      <div className="mt-1.5 flex min-w-0 items-center gap-2" key={c.id}>
                        <EntityAvatar
                          name={c.name}
                          size="size-7"
                          url={c.profilePicture}
                        />
                        <span className="min-w-0 text-sm font-medium [overflow-wrap:anywhere]">
                          {c.name}
                          {sel.approve === true ? " (Yes)" : ""}
                          {sel.approve === false ? " (No)" : ""}
                        </span>
                      </div>
                    ))
                  )}
                </li>
              );
            })}
          </ul>
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button
              onClick={() => {
                setReviewing(false);
              }}
              type="button"
              variant="outline"
            >
              Go back and change
            </Button>
            <Button loading={casting} onClick={submit} variant="brand">
              Yes, submit my ballot
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

export default function BallotPage({
  params,
}: {
  params: Promise<{ electionId: string }>;
}) {
  const { electionId } = use(params);
  return (
    <VoterChrome>
      <BallotBody electionId={electionId} />
    </VoterChrome>
  );
}
