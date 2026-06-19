"use client";

import { CheckCircle2, Copy, ShieldCheck } from "lucide-react";
import { use, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LinkButton } from "@/components/ui/link-button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { cn } from "@/lib/utils";
import { getApiErrorMessage } from "@/lib/api-error";
import { useCastBallotMutation, useGetVoterBallotQuery } from "@/redux/voting-api";

type Selection = { approve?: boolean; candidateIds: string[]; type: "ABSTAIN" | "VOTE" };

export default function BallotPage({
  params,
}: {
  params: Promise<{ electionId: string }>;
}) {
  const { electionId } = use(params);
  const { data, isError, isLoading } = useGetVoterBallotQuery(electionId);
  const [cast, { isLoading: casting }] = useCastBallotMutation();
  const [selections, setSelections] = useState<Record<string, Selection>>({});
  const [receipt, setReceipt] = useState<null | string>(null);

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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold sm:text-2xl">{ballot.election.name}</h1>
        <p className="text-sm text-muted-foreground">
          Make a choice for each position, then submit. Your ballot is secret.
        </p>
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
                    <div className="flex items-center justify-between rounded-lg border border-border p-3" key={c.id}>
                      <span className="font-medium">{c.name}</span>
                      <div className="flex gap-2">
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
                : p.candidates.map((c) => {
                    const chosen = sel?.candidateIds.includes(c.id);
                    return (
                      <button
                        className={cn(
                          "flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors",
                          chosen ? "border-brand bg-brand-muted" : "border-border hover:bg-accent",
                        )}
                        key={c.id}
                        onClick={() =>
                          p.votingMethod === "MULTI_SELECT"
                            ? toggleMulti(p.id, c.id, p.maxSelections)
                            : setSingle(p.id, c.id)
                        }
                        type="button"
                      >
                        <span
                          className={cn(
                            "flex size-5 shrink-0 items-center justify-center rounded-full border",
                            chosen ? "border-brand bg-brand text-brand-foreground" : "border-muted-foreground/40",
                          )}
                        >
                          {chosen && <CheckCircle2 className="size-3.5" />}
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate font-medium">{c.name}</span>
                          {c.party && <span className="block truncate text-xs text-muted-foreground">{c.party}</span>}
                        </span>
                      </button>
                    );
                  })}
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
        <Button disabled={!allAnswered} loading={casting} onClick={submit} variant="brand">
          Submit ballot
        </Button>
      </div>
    </div>
  );
}
