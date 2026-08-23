"use client";

// Election workspace - Settings tab: read-only-first cards (details,
// eligibility, voting & results) with inline edit forms, plus the danger
// zone. All edits ride maker-checker; a certified election is locked.
import { Lock, Pencil, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { use, useState } from "react";
import { toast } from "sonner";

import type { Election, EligibilityMode } from "@/types/api";

import {
  ELIGIBILITY_MODE_HINTS,
  ELIGIBILITY_MODE_LABELS,
} from "@/components/elections/election-lifecycle";
import { GroupPicker } from "@/components/elections/group-picker";
import { Button } from "@/components/ui/button";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { Field } from "@/components/ui/field";
import { Input, Select as NativeSelect, Textarea } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuthRole } from "@/hooks/use-auth-role";
import {
  useDeleteElectionMutation,
  useGetElectionQuery,
  useUpdateElectionMutation,
} from "@/redux/admin-api";
import { getApiErrorMessage } from "@/utils/extract-api-error";
import { type FormErrors, validateRequired } from "@/utils/form-validate";
import { formatDateTime } from "@/utils/format-date";

const pendingToast = (res: unknown, applied: string) => {
  toast.success(
    (res as { pending?: boolean }).pending ? "Submitted for approval" : applied,
  );
};

/** Format an ISO date for a datetime-local input (local time, minutes). */
const toLocalInput = (iso: string): string => {
  const date = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${String(date.getFullYear())}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate(),
  )}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

function SettingsCard({
  children,
  editable,
  editing,
  onToggleEdit,
  title,
}: {
  children: React.ReactNode;
  editable: boolean;
  editing: boolean;
  onToggleEdit: () => void;
  title: string;
}) {
  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">{title}</h2>
        {editable && !editing && (
          <Button onClick={onToggleEdit} size="xs" variant="outline">
            <Pencil className="size-3.5" /> Edit
          </Button>
        )}
      </div>
      {children}
    </section>
  );
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 text-sm min-[480px]:flex-row min-[480px]:justify-between">
      <dt className="shrink-0 text-muted-foreground">{label}</dt>
      <dd className="min-w-0 font-medium [overflow-wrap:anywhere] min-[480px]:text-right">
        {value}
      </dd>
    </div>
  );
}

function DetailsCard({ editable, election }: { editable: boolean; election: Election }) {
  const [editing, setEditing] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [update, { isLoading }] = useUpdateElectionMutation();

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const errs = validateRequired(f, {
      endDate: "End date",
      name: "Name",
      startDate: "Start date",
    });
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;
    try {
      const res = await update({
        data: {
          description: f.get("description") || null,
          endDate: f.get("endDate"),
          name: f.get("name"),
          startDate: f.get("startDate"),
        },
        id: election.id,
      }).unwrap();
      pendingToast(res, "Election updated");
      setEditing(false);
    } catch (error) {
      toast.error(getApiErrorMessage(error));
    }
  };

  return (
    <SettingsCard
      editable={editable}
      editing={editing}
      onToggleEdit={() => {
        setEditing(true);
      }}
      title="Details"
    >
      {editing ? (
        <form className="space-y-4" noValidate onSubmit={onSubmit}>
          <Field error={errors.name} label="Election name">
            <Input defaultValue={election.name} name="name" required />
          </Field>
          <Field label="Description">
            <Textarea
              defaultValue={election.description ?? ""}
              name="description"
              placeholder="Optional summary shown to voters"
            />
          </Field>
          <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2">
            <Field error={errors.startDate} label="Start date">
              <Input
                defaultValue={toLocalInput(election.startDate)}
                name="startDate"
                required
                type="datetime-local"
              />
            </Field>
            <Field error={errors.endDate} label="End date">
              <Input
                defaultValue={toLocalInput(election.endDate)}
                name="endDate"
                required
                type="datetime-local"
              />
            </Field>
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              onClick={() => {
                setEditing(false);
              }}
              type="button"
              variant="outline"
            >
              Cancel
            </Button>
            <Button loading={isLoading} type="submit" variant="brand">
              Save changes
            </Button>
          </div>
        </form>
      ) : (
        <dl className="space-y-2">
          <DetailRow label="Name" value={election.name} />
          {/* Prose can grow long: the label takes its own row and the text
              flows full-width beneath it, unlike the short side-by-side rows. */}
          <div className="text-sm">
            <dt className="text-muted-foreground">Description</dt>
            <dd className="mt-1 font-medium whitespace-pre-line [overflow-wrap:anywhere]">
              {election.description ?? "—"}
            </dd>
          </div>
          <DetailRow label="Opens" value={formatDateTime(election.startDate)} />
          <DetailRow label="Closes" value={formatDateTime(election.endDate)} />
          <DetailRow label="Slug" value={<span className="font-mono text-xs">{election.slug}</span>} />
        </dl>
      )}
    </SettingsCard>
  );
}

function EligibilityCard({ editable, election }: { editable: boolean; election: Election }) {
  const [editing, setEditing] = useState(false);
  const [update, { isLoading }] = useUpdateElectionMutation();
  const currentMode = (election.eligibilityMode ?? "ALL_VOTERS") as EligibilityMode;
  const [mode, setMode] = useState<EligibilityMode>(currentMode);
  const [groupIds, setGroupIds] = useState<string[]>(
    (election.eligibilityGroups ?? []).map(({ group }) => group.id),
  );
  const [groupError, setGroupError] = useState<string | undefined>();

  const onSave = async () => {
    if (mode === "GROUPS" && groupIds.length === 0) {
      setGroupError("Select at least one group");
      return;
    }
    setGroupError(undefined);
    try {
      const res = await update({
        data: {
          eligibilityMode: mode,
          groupIds: mode === "GROUPS" ? groupIds : [],
        },
        id: election.id,
      }).unwrap();
      pendingToast(res, "Eligibility updated");
      setEditing(false);
    } catch (error) {
      toast.error(getApiErrorMessage(error));
    }
  };

  return (
    <SettingsCard
      editable={editable}
      editing={editing}
      onToggleEdit={() => {
        setEditing(true);
      }}
      title="Who can vote"
    >
      {editing ? (
        <div className="space-y-4">
          <Field hint={ELIGIBILITY_MODE_HINTS[mode]} label="Eligibility">
            <NativeSelect
              onChange={(e) => {
                setMode(e.target.value as EligibilityMode);
              }}
              value={mode}
            >
              <option value="ALL_VOTERS">All registered voters</option>
              <option value="GROUPS">Specific groups</option>
              <option value="ROLL">Managed roll</option>
            </NativeSelect>
          </Field>
          {mode === "GROUPS" && (
            <GroupPicker error={groupError} onChange={setGroupIds} value={groupIds} />
          )}
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              onClick={() => {
                setEditing(false);
                setMode(currentMode);
              }}
              type="button"
              variant="outline"
            >
              Cancel
            </Button>
            <Button loading={isLoading} onClick={onSave} type="button" variant="brand">
              Save changes
            </Button>
          </div>
        </div>
      ) : (
        <div>
          <p className="text-sm font-medium">{ELIGIBILITY_MODE_LABELS[currentMode]}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {ELIGIBILITY_MODE_HINTS[currentMode]}
          </p>
          {currentMode === "GROUPS" && (
            // Plain list, never badges: group names are admin-authored text.
            <ul className="mt-3 space-y-1">
              {(election.eligibilityGroups ?? []).map(({ group }) => (
                <li className="min-w-0 text-sm [overflow-wrap:anywhere]" key={group.id}>
                  {group.name}
                  {group.category && (
                    <span className="text-xs text-muted-foreground"> · {group.category.name}</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </SettingsCard>
  );
}

/** Roles an admin may grant early results access (staff always see them). */
const EARLY_RESULTS_ROLES: { label: string; role: string }[] = [
  { label: "Agents", role: "AGENT" },
  { label: "Candidates", role: "CANDIDATE" },
  { label: "Accreditors", role: "ACCREDITOR" },
  { label: "Voters", role: "VOTER" },
];

const earlyRolesOf = (election: Election): string[] => {
  const roles = election.settings?.resultsVisibleToRoles;
  return Array.isArray(roles) ? roles.filter((r): r is string => typeof r === "string") : [];
};

function VotingCard({ editable, election }: { editable: boolean; election: Election }) {
  const [editing, setEditing] = useState(false);
  const [update, { isLoading }] = useUpdateElectionMutation();

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const passRaw = String(f.get("vettingPassPercent") ?? "").trim();
    try {
      const res = await update({
        data: {
          accreditationRequired: f.get("accreditationRequired") === "on",
          resultsPolicy: f.get("resultsPolicy"),
          vettingEnabled: f.get("vettingEnabled") === "on",
          vettingPassPercent: passRaw === "" ? null : Number(passRaw),
          voteCodeEnabled: f.get("voteCodeEnabled") === "on",
          voteVisibleToVoter: f.get("voteVisibleToVoter") === "on",
          // Merge into the settings JSON so unrelated keys survive.
          settings: {
            ...(election.settings ?? {}),
            ballotLayout: String(f.get("ballotLayout") ?? "list"),
            hiddenFromVoters: f.get("hiddenFromVoters") === "on",
            resultsVisibleToRoles: f.getAll("resultsVisibleToRoles").map(String),
          },
        },
        id: election.id,
      }).unwrap();
      pendingToast(res, "Voting settings updated");
      setEditing(false);
    } catch (error) {
      toast.error(getApiErrorMessage(error));
    }
  };

  const policyLabel =
    election.resultsPolicy === "LIVE"
      ? "Live while voting is open"
      : election.resultsPolicy === "MANUAL"
        ? "Published manually"
        : "Published when the election ends";

  return (
    <SettingsCard
      editable={editable}
      editing={editing}
      onToggleEdit={() => {
        setEditing(true);
      }}
      title="Voting & results"
    >
      {editing ? (
        <form className="space-y-4" noValidate onSubmit={onSubmit}>
          <Field label="Results visibility">
            <NativeSelect defaultValue={election.resultsPolicy} name="resultsPolicy">
              <option value="ON_CLOSE">When election ends</option>
              <option value="LIVE">Live</option>
              <option value="MANUAL">Manual publish</option>
            </NativeSelect>
          </Field>
          <label className="flex items-center gap-2 text-sm">
            <input
              className="size-4 accent-brand"
              defaultChecked={election.accreditationRequired ?? false}
              name="accreditationRequired"
              type="checkbox"
            />
            Voters must be accredited before voting
          </label>
          <label
            className="flex items-center gap-2 text-sm"
            title="Removes this election from the voter portal entirely - upcoming, open, and history. Use it to clear the console down to only the election that matters on voting day."
          >
            <input
              className="size-4 accent-brand"
              defaultChecked={election.settings?.hiddenFromVoters === true}
              name="hiddenFromVoters"
              type="checkbox"
            />
            Hide this election from the voter portal
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              className="size-4 accent-brand"
              defaultChecked={election.voteCodeEnabled ?? false}
              name="voteCodeEnabled"
              type="checkbox"
            />
            Accreditation hands each voter a one-time sign-in code
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              className="size-4 accent-brand"
              defaultChecked={election.vettingEnabled ?? false}
              name="vettingEnabled"
              type="checkbox"
            />
            Candidates pass vetting before reaching the ballot
          </label>
          {/*
            Not a display preference: this decides whether the election is a
            secret ballot at all, so the consequence is spelled out rather
            than left to the label.
          */}
          <label className="flex items-start gap-2 rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm">
            <input
              className="mt-0.5 size-4 shrink-0 accent-brand"
              defaultChecked={election.voteVisibleToVoter ?? false}
              name="voteVisibleToVoter"
              type="checkbox"
            />
            <span className="min-w-0">
              <span className="font-medium">
                Open ballot: voters can see what they voted
              </span>
              <span className="mt-1 block text-xs text-muted-foreground">
                Stores each voter&apos;s ballot against their name so they can
                review it later. This makes the election NOT secret - anyone
                with database access can see how each person voted, and voters
                are told so before they cast. Right for a board or committee
                vote; wrong wherever someone could be pressured. Turning it
                off again deletes the stored links.
              </span>
            </span>
          </label>
          <Field
            hint="Once every criterion is scored, candidates at or above this share of the maximum auto-qualify and the rest auto-disqualify. Leave empty for manual decisions."
            label="Vetting pass mark (%)"
          >
            <Input
              className="max-w-28"
              defaultValue={election.vettingPassPercent ?? ""}
              max={100}
              min={1}
              name="vettingPassPercent"
              placeholder="e.g. 60"
              type="number"
            />
          </Field>
          <Field
            hint="How candidates appear on the voter's ballot: a vertical list, or cards side by side."
            label="Ballot layout"
          >
            <NativeSelect
              defaultValue={String(election.settings?.ballotLayout ?? "list")}
              name="ballotLayout"
            >
              <option value="list">Vertical list (stacked)</option>
              <option value="grid">Horizontal cards (side by side)</option>
            </NativeSelect>
          </Field>
          <fieldset>
            <legend className="text-sm font-medium">Early results access</legend>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Checked roles can watch results even before they are published -
              regardless of the visibility policy above. Administrators always
              can.
            </p>
            <div className="mt-2 grid grid-cols-1 gap-1.5 min-[360px]:grid-cols-2">
              {EARLY_RESULTS_ROLES.map(({ label, role }) => (
                <label className="flex items-center gap-2 text-sm" key={role}>
                  <input
                    className="size-4 accent-brand"
                    defaultChecked={earlyRolesOf(election).includes(role)}
                    name="resultsVisibleToRoles"
                    type="checkbox"
                    value={role}
                  />
                  {label}
                </label>
              ))}
            </div>
          </fieldset>
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              onClick={() => {
                setEditing(false);
              }}
              type="button"
              variant="outline"
            >
              Cancel
            </Button>
            <Button loading={isLoading} type="submit" variant="brand">
              Save changes
            </Button>
          </div>
        </form>
      ) : (
        <dl className="space-y-2">
          <DetailRow label="Results" value={policyLabel} />
          <DetailRow
            label="Accreditation"
            value={election.accreditationRequired ? "Required before voting" : "Not required"}
          />
          <DetailRow
            label="Voting codes"
            value={
              election.voteCodeEnabled
                ? "One-time sign-in code issued at accreditation"
                : "Voters sign in with SMS/email codes"
            }
          />
          <DetailRow
            label="Ballot secrecy"
            value={
              election.voteVisibleToVoter
                ? "Open ballot - each voter's choices are recorded against their name"
                : "Secret ballot - no record links a voter to their ballot"
            }
          />
          <DetailRow
            label="Vetting"
            value={
              election.vettingEnabled
                ? election.vettingPassPercent != null
                  ? `Vetting panel, auto-decided at a ${String(election.vettingPassPercent)}% pass mark`
                  : "Vetting panel, manual decisions"
                : "Candidates go straight onto the ballot"
            }
          />
          <DetailRow
            label="Voter portal"
            value={
              election.settings?.hiddenFromVoters === true
                ? "Hidden from voters"
                : "Visible to eligible voters"
            }
          />
          <DetailRow
            label="Ballot layout"
            value={
              String(election.settings?.ballotLayout ?? "list") === "grid"
                ? "Horizontal cards (side by side)"
                : "Vertical list (stacked)"
            }
          />
          <DetailRow
            label="Early results access"
            value={
              earlyRolesOf(election).length
                ? EARLY_RESULTS_ROLES.filter(({ role }) =>
                    earlyRolesOf(election).includes(role),
                  )
                    .map(({ label }) => label)
                    .join(", ")
                : "Staff only"
            }
          />
        </dl>
      )}
    </SettingsCard>
  );
}

function DangerZone({ election }: { election: Election }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [deleteElection] = useDeleteElectionMutation();

  return (
    <section className="rounded-xl border border-destructive/30 p-5">
      <h2 className="text-sm font-semibold text-destructive">Danger zone</h2>
      <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-muted-foreground">
          Deleting removes this election and everything under it from every
          list. It can be restored from Deleted records.
        </p>
        <Button
          onClick={() => {
            setConfirming(true);
          }}
          size="sm"
          variant="destructive"
        >
          <Trash2 className="size-4" /> Delete election
        </Button>
      </div>
      <ConfirmationDialog
        confirmText="Delete election"
        description={`"${election.name}" and its portfolios, candidates, and roll will be removed.`}
        isDestructive
        onConfirm={async () => {
          setConfirming(false);
          try {
            await deleteElection(election.id).unwrap();
            toast.success("Election deleted");
            router.push("/admin/elections");
          } catch (error) {
            toast.error(getApiErrorMessage(error));
          }
        }}
        onOpenChange={(open) => {
          if (!open) setConfirming(false);
        }}
        open={confirming}
        requireExactMatch="delete"
        title="Delete this election?"
      />
    </section>
  );
}

export default function ElectionSettingsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { isSuperAdmin } = useAuthRole();
  const { data, isLoading } = useGetElectionQuery(id);
  const election = data?.data;

  if (isLoading || !election) {
    return (
      <div className="space-y-4">
        {[0, 1, 2].map((i) => (
          <Skeleton className="h-40 rounded-xl" key={i} />
        ))}
      </div>
    );
  }

  const editable = !election.isLocked;

  return (
    <div className="space-y-4">
      {election.isLocked && (
        <div className="flex items-start gap-2.5 rounded-xl border border-border bg-muted/40 px-4 py-3 text-sm">
          <Lock className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          <p className="text-muted-foreground">
            Results are certified, so this election&apos;s content is locked. It
            can still be archived from the status control in the header.
          </p>
        </div>
      )}
      <DetailsCard editable={editable} election={election} />
      <EligibilityCard editable={editable} election={election} key={`elig-${election.id}-${String(election.eligibilityMode)}`} />
      <VotingCard editable={editable} election={election} />
      {isSuperAdmin && <DangerZone election={election} />}
    </div>
  );
}
