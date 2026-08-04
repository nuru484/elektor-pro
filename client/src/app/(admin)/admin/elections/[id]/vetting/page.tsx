"use client";

// Election workspace - Vetting tab: enable vetting, manage the criteria the
// panel scores against, review the nomination queue, and assign ballot
// numbers. Individual scoring + decisions live on each candidate's profile.
import {
  ClipboardCheck,
  Hash,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { use, useState } from "react";
import { toast } from "sonner";

import type { CandidateStatus, VettingCriterion } from "@/types/api";

import { CANDIDATE_STATUS_LABELS } from "@/components/candidates/candidate-lifecycle";
import { EntityAvatar } from "@/components/console/entity-avatar";
import { Button } from "@/components/ui/button";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { Field } from "@/components/ui/field";
import { Input, Select as NativeSelect, Textarea } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/states";
import { StatusBadge } from "@/components/ui/status-badge";
import { useAuthRole } from "@/hooks/use-auth-role";
import {
  useAutoAssignBallotNumbersMutation,
  useCreateCriterionMutation,
  useDeleteCriterionMutation,
  useGetElectionQuery,
  useListCandidatesQuery,
  useListCriteriaQuery,
  useUpdateCriterionMutation,
} from "@/redux/admin-api";
import { getApiErrorMessage } from "@/utils/extract-api-error";
import { type FormErrors, validateRequired } from "@/utils/form-validate";

const QUEUE_STATUSES: CandidateStatus[] = [
  "DRAFT",
  "UNDER_REVIEW",
  "QUALIFIED",
  "DISQUALIFIED",
  "WITHDRAWN",
];

function CriterionModal({
  criterion,
  electionId,
  onClose,
  open,
}: {
  criterion: null | VettingCriterion;
  electionId: string;
  onClose: () => void;
  open: boolean;
}) {
  const [create, { isLoading: creating }] = useCreateCriterionMutation();
  const [update, { isLoading: updating }] = useUpdateCriterionMutation();
  const [errors, setErrors] = useState<FormErrors>({});

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const errs = validateRequired(f, { name: "Name" });
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;
    const data = {
      description: f.get("description") || undefined,
      maxScore: Number(f.get("maxScore") || 10),
      name: f.get("name"),
      order: Number(f.get("order") || 0),
    };
    try {
      if (criterion) await update({ data, id: criterion.id }).unwrap();
      else await create({ data, electionId }).unwrap();
      toast.success(criterion ? "Criterion updated" : "Criterion created");
      onClose();
    } catch (error) {
      toast.error(getApiErrorMessage(error));
    }
  };

  return (
    <Modal
      description="One yardstick the vetting panel scores every nomination against."
      onClose={onClose}
      open={open}
      title={criterion ? "Edit criterion" : "New criterion"}
    >
      <form className="space-y-4" noValidate onSubmit={onSubmit}>
        <Field error={errors.name} label="Name">
          <Input
            defaultValue={criterion?.name ?? ""}
            name="name"
            placeholder="e.g. Academic standing"
            required
          />
        </Field>
        <Field label="Description">
          <Textarea
            defaultValue={criterion?.description ?? ""}
            name="description"
            placeholder="What the panel should consider (optional)"
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field hint="Highest score a panelist can give." label="Max score">
            <Input
              defaultValue={criterion?.maxScore ?? 10}
              min={1}
              name="maxScore"
              type="number"
            />
          </Field>
          <Field hint="Display position." label="Order">
            <Input
              defaultValue={criterion?.order ?? 0}
              min={0}
              name="order"
              type="number"
            />
          </Field>
        </div>
        <Button className="w-full" loading={creating || updating} type="submit" variant="brand">
          {criterion ? "Save changes" : "Create criterion"}
        </Button>
      </form>
    </Modal>
  );
}

export default function ElectionVettingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: electionId } = use(params);
  const { can } = useAuthRole();
  const canVet = can("VET_CANDIDATES");
  const canManage = can("MANAGE_CANDIDATES");

  const { data: electionData, isLoading: electionLoading } =
    useGetElectionQuery(electionId);
  const election = electionData?.data;
  const vettingOn = election?.vettingEnabled ?? false;

  const { data: criteriaData, isLoading: criteriaLoading } = useListCriteriaQuery(
    electionId,
    { skip: !vettingOn },
  );
  const criteria = criteriaData?.data ?? [];

  const [queueStatus, setQueueStatus] = useState<"" | CandidateStatus>("");
  const { data: queueData, isLoading: queueLoading } = useListCandidatesQuery(
    { electionId, limit: 100, ...(queueStatus ? { status: queueStatus } : {}) },
    { skip: !vettingOn },
  );
  const queue = queueData?.data ?? [];

  const [modal, setModal] = useState<{ criterion: null | VettingCriterion; open: boolean }>({
    criterion: null,
    open: false,
  });
  const [deleting, setDeleting] = useState<null | VettingCriterion>(null);
  const [deleteCriterion] = useDeleteCriterionMutation();
  const [autoOpen, setAutoOpen] = useState(false);
  const [strategy, setStrategy] = useState<"ALPHABETICAL" | "SCORE">("SCORE");
  const [autoAssign, { isLoading: assigning }] = useAutoAssignBallotNumbersMutation();

  if (electionLoading || !election) {
    return <Skeleton className="h-64 rounded-xl" />;
  }

  if (!vettingOn) {
    return (
      <EmptyState
        action={
          <Button asChild variant="brand">
            <Link href={`/admin/elections/${electionId}/settings`}>
              Enable vetting in Settings
            </Link>
          </Button>
        }
        description="With vetting on, new nominations arrive as drafts, the panel scores them against your criteria, and only qualified candidates reach the ballot."
        icon={ClipboardCheck}
        title="Vetting is off for this election"
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* Criteria */}
      <section className="rounded-xl border border-border bg-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold">Vetting criteria</h2>
            <p className="text-xs text-muted-foreground">
              What the panel scores every nomination against.
              {election.vettingPassPercent != null
                ? ` Fully scored candidates auto-qualify at ${String(election.vettingPassPercent)}% and above (set in Settings).`
                : " Decisions are manual - set a pass mark in Settings to auto-decide."}
            </p>
          </div>
          {canVet && (
            <Button
              onClick={() => {
                setModal({ criterion: null, open: true });
              }}
              size="sm"
              variant="brand"
            >
              <Plus className="size-4" /> New criterion
            </Button>
          )}
        </div>
        <div className="mt-3">
          {criteriaLoading ? (
            <Skeleton className="h-20 rounded-lg" />
          ) : criteria.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No criteria yet - add the first yardstick above.
            </p>
          ) : (
            <ul className="divide-y divide-border rounded-lg border border-border">
              {criteria.map((criterion) => (
                // Text and actions never share the width on phones: the text
                // block owns the full row, actions sit on their own row below
                // (side-by-side again from sm).
                <li
                  className="flex flex-col gap-2 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:gap-3"
                  key={criterion.id}
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium [overflow-wrap:anywhere]">
                      {criterion.name}
                    </p>
                    {criterion.description && (
                      <p className="mt-0.5 text-xs text-muted-foreground [overflow-wrap:anywhere]">
                        {criterion.description}
                      </p>
                    )}
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Max {criterion.maxScore} · {criterion._count?.scores ?? 0} scores
                    </p>
                  </div>
                  {canVet && (
                    <div className="flex shrink-0 gap-1">
                      <Button
                        aria-label={`Edit ${criterion.name}`}
                        onClick={() => {
                          setModal({ criterion, open: true });
                        }}
                        size="icon-sm"
                        variant="ghost"
                      >
                        <Pencil className="size-4" />
                      </Button>
                      <Button
                        aria-label={`Delete ${criterion.name}`}
                        onClick={() => {
                          setDeleting(criterion);
                        }}
                        size="icon-sm"
                        variant="ghost"
                      >
                        <Trash2 className="size-4 text-destructive" />
                      </Button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* Ballot numbers */}
      <section className="rounded-xl border border-border bg-card p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-2.5">
            <Hash className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            <div>
              <h2 className="text-sm font-semibold">Ballot numbers</h2>
              <p className="text-xs text-muted-foreground">
                Number qualified candidates per portfolio - automatically here,
                or per candidate on their profile.
              </p>
            </div>
          </div>
          {canManage && (
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              <NativeSelect
                aria-label="Assignment strategy"
                className="h-9 w-auto text-xs"
                onChange={(e) => {
                  setStrategy(e.target.value as "ALPHABETICAL" | "SCORE");
                }}
                value={strategy}
              >
                <option value="SCORE">By vetting score</option>
                <option value="ALPHABETICAL">Alphabetical</option>
              </NativeSelect>
              <Button
                loading={assigning}
                onClick={() => {
                  setAutoOpen(true);
                }}
                size="sm"
                variant="brand"
              >
                Auto-assign
              </Button>
            </div>
          )}
        </div>
      </section>

      {/* Review queue */}
      <section className="rounded-xl border border-border bg-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold">Nomination queue</h2>
            <p className="text-xs text-muted-foreground">
              Open a candidate to score and decide their qualification.
            </p>
          </div>
          <NativeSelect
            aria-label="Filter by status"
            className="h-9 w-auto text-xs"
            onChange={(e) => {
              setQueueStatus(e.target.value as "" | CandidateStatus);
            }}
            value={queueStatus}
          >
            <option value="">All statuses</option>
            {QUEUE_STATUSES.map((status) => (
              <option key={status} value={status}>
                {CANDIDATE_STATUS_LABELS[status]}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="mt-3">
          {queueLoading ? (
            <Skeleton className="h-24 rounded-lg" />
          ) : queue.length === 0 ? (
            <p className="text-sm text-muted-foreground">No candidates match.</p>
          ) : (
            <ul className="divide-y divide-border rounded-lg border border-border">
              {queue.map((candidate) => (
                <li key={candidate.id}>
                  <Link
                    className="flex items-center gap-3 px-3 py-2.5 transition-colors hover:bg-accent"
                    href={`/admin/candidates/${candidate.id}`}
                    title="Open the candidate's profile to score and decide"
                  >
                    <EntityAvatar
                      name={candidate.name}
                      size="size-7"
                      url={candidate.profilePicture}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">
                        {candidate.name}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {candidate.portfolio?.name ?? "—"}
                        {candidate.ballotNumber != null
                          ? ` · No. ${String(candidate.ballotNumber)}`
                          : ""}
                      </span>
                    </span>
                    <StatusBadge status={candidate.status ?? "QUALIFIED"} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <CriterionModal
        criterion={modal.criterion}
        electionId={electionId}
        key={modal.criterion?.id ?? (modal.open ? "new" : "closed")}
        onClose={() => {
          setModal({ criterion: null, open: false });
        }}
        open={modal.open}
      />
      <ConfirmationDialog
        confirmText="Delete criterion"
        description={`"${deleting?.name ?? ""}" and its recorded scores will be removed.`}
        isDestructive
        onConfirm={async () => {
          if (!deleting) return;
          setDeleting(null);
          try {
            await deleteCriterion(deleting.id).unwrap();
            toast.success("Criterion deleted");
          } catch (error) {
            toast.error(getApiErrorMessage(error));
          }
        }}
        onOpenChange={(open) => {
          if (!open) setDeleting(null);
        }}
        open={deleting !== null}
        title="Delete this criterion?"
      />
      <ConfirmationDialog
        confirmText="Assign numbers"
        description={`Every qualified candidate gets a fresh number per portfolio, ordered ${
          strategy === "SCORE" ? "by vetting score (highest first)" : "alphabetically"
        }. Existing numbers are replaced.`}
        onConfirm={async () => {
          setAutoOpen(false);
          try {
            const res = await autoAssign({ electionId, strategy }).unwrap();
            toast.success(`${String(res.data.assigned)} ballot numbers assigned`);
          } catch (error) {
            toast.error(getApiErrorMessage(error));
          }
        }}
        onOpenChange={setAutoOpen}
        open={autoOpen}
        title="Auto-assign ballot numbers?"
      />
    </div>
  );
}
