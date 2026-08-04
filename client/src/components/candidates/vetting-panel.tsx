"use client";

// The vetting picture for one candidate: score breakdown per criterion, the
// panelist's own score entry, and the qualification decision - shown only on
// vetting-enabled elections. Server enforcement is the real gate; capability
// checks here only hide controls the actor cannot use.
import { ClipboardCheck } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import type { Candidate, CandidateStatus } from "@/types/api";

import {
  DECISION_ACTIONS,
  legalCandidateDecisions,
} from "@/components/candidates/candidate-lifecycle";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input, Textarea } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/ui/status-badge";
import { useAuthRole } from "@/hooks/use-auth-role";
import {
  useDecideCandidateMutation,
  useGetCandidateVettingQuery,
  useScoreCandidateMutation,
} from "@/redux/admin-api";
import { getApiErrorMessage } from "@/utils/extract-api-error";
import { formatDateTime } from "@/utils/format-date";

function DecisionModal({
  candidate,
  onClose,
  status,
}: {
  candidate: Candidate;
  onClose: () => void;
  status: CandidateStatus | null;
}) {
  const [decide, { isLoading }] = useDecideCandidateMutation();
  const [note, setNote] = useState("");

  const confirm = async () => {
    if (!status) return;
    try {
      await decide({
        candidateId: candidate.id,
        note: note.trim() || undefined,
        status,
      }).unwrap();
      toast.success(`${DECISION_ACTIONS[status] ?? status} recorded`);
      onClose();
    } catch (error) {
      toast.error(getApiErrorMessage(error));
    }
  };

  return (
    <Modal
      description={`"${candidate.name}" will be marked ${status?.replaceAll("_", " ").toLowerCase() ?? ""}.`}
      onClose={onClose}
      open={status !== null}
      title={`${status ? (DECISION_ACTIONS[status] ?? status) : ""} this candidate?`}
    >
      <div className="space-y-4">
        <Field hint="Recorded on the candidacy and in the audit trail." label="Decision note">
          <Textarea
            onChange={(e) => {
              setNote(e.target.value);
            }}
            placeholder="Why this decision was taken (optional)"
            value={note}
          />
        </Field>
        <div className="flex flex-wrap justify-end gap-2">
          <Button onClick={onClose} type="button" variant="outline">
            Cancel
          </Button>
          <Button
            loading={isLoading}
            onClick={confirm}
            type="button"
            variant={status === "QUALIFIED" ? "brand" : "destructive"}
          >
            {status ? (DECISION_ACTIONS[status] ?? status) : ""}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

export function VettingPanel({ candidate }: { candidate: Candidate }) {
  const { can } = useAuthRole();
  const canVet = can("VET_CANDIDATES");
  const { data, isLoading } = useGetCandidateVettingQuery(candidate.id, {
    skip: !candidate.election?.vettingEnabled,
  });
  const [scoreCandidate] = useScoreCandidateMutation();
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<null | string>(null);
  const [decision, setDecision] = useState<CandidateStatus | null>(null);

  if (!candidate.election?.vettingEnabled) return null;

  const vetting = data?.data;
  const status = candidate.status ?? "QUALIFIED";

  const submitScore = async (criterionId: string, maxScore: number) => {
    const raw = drafts[criterionId];
    const score = Number(raw);
    if (raw === undefined || raw === "" || Number.isNaN(score)) return;
    if (score < 0 || score > maxScore) {
      toast.error(`Score must be between 0 and ${String(maxScore)}`);
      return;
    }
    setSaving(criterionId);
    try {
      await scoreCandidate({ candidateId: candidate.id, criterionId, score }).unwrap();
      toast.success("Score recorded");
      setDrafts((prev) => {
        const next = { ...prev };
        delete next[criterionId];
        return next;
      });
    } catch (error) {
      toast.error(getApiErrorMessage(error));
    } finally {
      setSaving(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <ClipboardCheck className="size-4 text-muted-foreground" /> Vetting
            </CardTitle>
            <CardDescription>
              {candidate.election.vettingPassPercent != null
                ? `Fully scored candidates auto-qualify at ${String(candidate.election.vettingPassPercent)}% of the maximum total; manual decisions stay possible.`
                : "Panel scores against this election's criteria; qualification is decided manually below."}
            </CardDescription>
          </div>
          <div className="text-right">
            <StatusBadge status={status} />
            {vetting && vetting.maxTotal > 0 && (
              <p className="mt-1 font-mono text-sm font-semibold tabular-nums">
                {vetting.total} / {vetting.maxTotal}
              </p>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading && <Skeleton className="h-24 rounded-lg" />}

        {vetting && vetting.byCriterion.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No vetting criteria defined yet - add them on the election&apos;s
            Vetting tab.
          </p>
        )}

        {vetting && vetting.byCriterion.length > 0 && (
          <ul className="divide-y divide-border rounded-lg border border-border">
            {vetting.byCriterion.map(({ average, criterion, scores }) => (
              <li className="flex flex-col gap-2 px-3 py-2.5" key={criterion.id}>
                <div className="flex items-baseline justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium [overflow-wrap:anywhere]">
                      {criterion.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {scores.length} score{scores.length === 1 ? "" : "s"} · max{" "}
                      {criterion.maxScore}
                    </p>
                  </div>
                  <span className="shrink-0 font-mono text-sm font-semibold tabular-nums">
                    {average ?? "—"} / {criterion.maxScore}
                  </span>
                </div>
                {canVet && (
                  <div className="flex items-center gap-2">
                    <Input
                      aria-label={`Your score for ${criterion.name}`}
                      className="h-9 w-24"
                      max={criterion.maxScore}
                      min={0}
                      onChange={(e) => {
                        setDrafts((prev) => ({
                          ...prev,
                          [criterion.id]: e.target.value,
                        }));
                      }}
                      placeholder="Score"
                      type="number"
                      value={drafts[criterion.id] ?? ""}
                    />
                    <Button
                      disabled={!drafts[criterion.id]}
                      loading={saving === criterion.id}
                      onClick={() => void submitScore(criterion.id, criterion.maxScore)}
                      size="sm"
                      type="button"
                      variant="outline"
                    >
                      Save my score
                    </Button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}

        {(candidate.reviewedBy ?? candidate.vettingNote) && (
          <div className="rounded-lg bg-muted/40 px-3 py-2.5 text-xs text-muted-foreground">
            {candidate.reviewedBy && (
              <p>
                Decided by {candidate.reviewedBy.firstName} {candidate.reviewedBy.lastName}
                {candidate.reviewedAt ? ` · ${formatDateTime(candidate.reviewedAt)}` : ""}
              </p>
            )}
            {candidate.vettingNote && (
              <p className="mt-1 [overflow-wrap:anywhere]">“{candidate.vettingNote}”</p>
            )}
          </div>
        )}

        {canVet && legalCandidateDecisions(status).length > 0 && (
          <div className="flex flex-wrap gap-2 border-t border-border pt-4">
            {legalCandidateDecisions(status).map((next) => (
              <Button
                key={next}
                onClick={() => {
                  setDecision(next);
                }}
                size="sm"
                type="button"
                variant={next === "QUALIFIED" ? "brand" : "outline"}
              >
                {DECISION_ACTIONS[next] ?? next}
              </Button>
            ))}
          </div>
        )}
      </CardContent>

      <DecisionModal
        candidate={candidate}
        key={decision ?? "closed"}
        onClose={() => {
          setDecision(null);
        }}
        status={decision}
      />
    </Card>
  );
}
