"use client";

// The accreditation desk: pick an open election, look a voter up, see their
// standing at a glance, check them in - and where the election uses one-time
// codes, hand the code over. Built for the busy queue: search is debounced,
// statuses are unmissable, actions stack under the text on phones.
import { BadgeCheck, CheckCircle2, ShieldX, UserRoundSearch, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import type { AccreditationSearchRow } from "@/types/api";

import { VoteCodeDialog } from "@/components/accreditation/code-dialog";
import { EntityAvatar } from "@/components/console/entity-avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { Field } from "@/components/ui/field";
import { Input, Select as NativeSelect } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, PageHeader } from "@/components/ui/states";
import { useDebounce } from "@/hooks/use-debounce";
import {
  useAccreditVoterMutation,
  useGetTurnoutQuery,
  useListElectionsQuery,
  useSearchAccreditationQuery,
} from "@/redux/admin-api";
import { getApiErrorMessage } from "@/utils/extract-api-error";
import { formatDateTime } from "@/utils/format-date";

const fmt = (n: number) => n.toLocaleString();

function ResultRow({
  onAccredit,
  row,
}: {
  onAccredit: (row: AccreditationSearchRow) => void;
  row: AccreditationSearchRow;
}) {
  const canAccredit = row.eligible && !row.hasVoted;
  return (
    <li className="flex flex-col gap-2 px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
      <div className="flex min-w-0 items-center gap-2.5">
        <EntityAvatar name={row.name} url={row.profilePicture} />
        <div className="min-w-0">
          <p className="min-w-0 text-sm font-medium [overflow-wrap:anywhere]">
            {row.name}
          </p>
          <p className="truncate font-mono text-xs text-muted-foreground">
            {row.voterId}
            {row.phoneNumber ? ` · ${row.phoneNumber}` : ""}
          </p>
          <p className="mt-1 flex flex-wrap items-center gap-1.5">
            {row.eligible ? (
              <Badge title="This voter may vote in the selected election" variant="success">
                Eligible
              </Badge>
            ) : (
              <Badge
                title="Outside this election's scope or explicitly excluded - cannot be accredited"
                variant="destructive"
              >
                Not eligible
              </Badge>
            )}
            {row.accreditedAt && (
              <span
                className="text-xs text-muted-foreground"
                title="Already checked in at the desk"
              >
                Accredited {formatDateTime(row.accreditedAt)}
              </span>
            )}
            {row.hasVoted && (
              <Badge title="Their ballot is already recorded" variant="brand">
                Voted
              </Badge>
            )}
            {row.codeIssued && !row.hasVoted && (
              <span
                className="text-xs text-muted-foreground"
                title="A one-time voting code was handed to this voter and has not been used yet"
              >
                Code issued
              </span>
            )}
          </p>
        </div>
      </div>
      {/* Actions on their own row below sm - never squeezing the name. */}
      <div className="shrink-0">
        {canAccredit ? (
          <Button
            onClick={() => {
              onAccredit(row);
            }}
            size="sm"
            title={
              row.accreditedAt
                ? "Check them in again; any unused voting code is replaced"
                : "Check this voter in for the selected election"
            }
            variant="brand"
          >
            <BadgeCheck className="size-4" />
            {row.accreditedAt ? "Re-accredit" : "Accredit"}
          </Button>
        ) : row.hasVoted ? (
          <span
            className="inline-flex items-center gap-1 text-xs font-medium text-success"
            title="Their ballot is recorded; accreditation can no longer change"
          >
            <CheckCircle2 className="size-3.5" /> Done voting
          </span>
        ) : (
          <span
            className="inline-flex items-center gap-1 text-xs text-muted-foreground"
            title="Not eligible for this election - only eligible voters can be checked in"
          >
            <ShieldX className="size-3.5" /> Cannot accredit
          </span>
        )}
      </div>
    </li>
  );
}

export default function AccreditPage() {
  const [electionId, setElectionId] = useState("");
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search.trim(), 400);
  const [confirming, setConfirming] = useState<AccreditationSearchRow | null>(null);
  const [issuedCode, setIssuedCode] = useState<null | string>(null);
  const [codeVoter, setCodeVoter] = useState("");

  const { data: electionsData } = useListElectionsQuery({
    limit: 100,
    status: "IN_PROGRESS",
  });
  const elections = electionsData?.data ?? [];

  // With no query the server returns the election's eligible register (A-Z),
  // so the desk shows voters as soon as an election is picked.
  const { data, isFetching } = useSearchAccreditationQuery(
    { electionId, query: debouncedSearch },
    { skip: !electionId },
  );
  const rows = data?.data ?? [];
  const searching = debouncedSearch.length >= 2;

  const { data: turnoutData } = useGetTurnoutQuery(electionId, {
    pollingInterval: 30_000,
    skip: !electionId,
  });
  const turnout = turnoutData?.data;

  const [accredit] = useAccreditVoterMutation();
  const doAccredit = async (row: AccreditationSearchRow) => {
    setConfirming(null);
    try {
      const res = await accredit({ electionId, voterId: row.id }).unwrap();
      toast.success(`${row.name} accredited`);
      if (res.data.voteCode) {
        setCodeVoter(row.name);
        setIssuedCode(res.data.voteCode);
      }
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Could not accredit"));
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        description="Check voters in for an election - and hand over their one-time voting code where the election uses codes."
        title="Accreditation desk"
      />

      <div className="grid gap-3 sm:grid-cols-[minmax(0,320px)_1fr]">
        <Field label="Election">
          <NativeSelect
            onChange={(e) => {
              setElectionId(e.target.value);
            }}
            title="Only elections currently open for voting are listed"
            value={electionId}
          >
            <option value="">Select an open election…</option>
            {elections.map((election) => (
              <option key={election.id} value={election.id}>
                {election.name}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field
          hint="Name, voter ID, or phone. Leave empty to browse the eligible register."
          label="Find voter"
        >
          <div className="relative">
            <Input
              className="pr-9"
              disabled={!electionId}
              onChange={(e) => {
                setSearch(e.target.value);
              }}
              placeholder="Search the register…"
              title="Search by name, voter ID, or phone number"
              value={search}
            />
            {search.length > 0 && (
              <button
                aria-label="Clear search"
                className="absolute inset-y-0 right-0 flex w-9 items-center justify-center text-muted-foreground hover:text-foreground"
                onClick={() => {
                  setSearch("");
                }}
                title="Clear search"
                type="button"
              >
                <X className="size-4" />
              </button>
            )}
          </div>
        </Field>
      </div>

      {turnout && (
        <div className="grid grid-cols-3 gap-3">
          <div
            className="rounded-xl border border-border bg-card px-3 py-2.5"
            title="Everyone allowed to vote in this election"
          >
            <p className="text-[11px] font-medium text-muted-foreground">Eligible</p>
            <p className="font-mono text-lg font-semibold tabular-nums">
              {fmt(turnout.eligible)}
            </p>
          </div>
          <div
            className="rounded-xl border border-border bg-card px-3 py-2.5"
            title="Voters checked in at the desk so far (refreshes every 30 seconds)"
          >
            <p className="text-[11px] font-medium text-muted-foreground">Accredited</p>
            <p className="font-mono text-lg font-semibold tabular-nums">
              {fmt(turnout.accredited)}
            </p>
          </div>
          <div
            className="rounded-xl border border-border bg-card px-3 py-2.5"
            title="Ballots recorded so far (refreshes every 30 seconds)"
          >
            <p className="text-[11px] font-medium text-muted-foreground">Voted</p>
            <p className="font-mono text-lg font-semibold tabular-nums">
              {fmt(turnout.voted)}
            </p>
          </div>
        </div>
      )}

      {!electionId ? (
        <EmptyState
          description="Pick the election you are accrediting for; its eligible voters appear right away and the search narrows them down."
          icon={UserRoundSearch}
          title="Select an election to begin"
        />
      ) : isFetching ? (
        <Skeleton className="h-32 rounded-xl" />
      ) : rows.length === 0 ? (
        <EmptyState
          description={
            searching
              ? "No voter matches that search. Check the spelling or try their voter ID."
              : "No voters are eligible for this election yet - register voters or build the roll first."
          }
          icon={UserRoundSearch}
          title={searching ? "No matches" : "Nobody eligible yet"}
        />
      ) : (
        <div className="space-y-2">
          <ul className="divide-y divide-border rounded-xl border border-border bg-card">
            {rows.map((row) => (
              <ResultRow key={row.id} onAccredit={setConfirming} row={row} />
            ))}
          </ul>
          {!searching && (
            <p className="text-xs text-muted-foreground">
              Showing the first {rows.length} eligible voters A-Z. Search to find
              anyone else.
            </p>
          )}
        </div>
      )}

      <ConfirmationDialog
        confirmText={confirming?.accreditedAt ? "Re-accredit" : "Accredit"}
        description={`"${confirming?.name ?? ""}" (${confirming?.voterId ?? ""}) will be checked in for this election${
          confirming?.accreditedAt ? "; any earlier unused code is replaced" : ""
        }.`}
        onConfirm={() => {
          if (confirming) void doAccredit(confirming);
        }}
        onOpenChange={(open) => {
          if (!open) setConfirming(null);
        }}
        open={confirming !== null}
        title="Accredit this voter?"
      />
      <VoteCodeDialog
        code={issuedCode}
        onClose={() => {
          setIssuedCode(null);
        }}
        voterName={codeVoter}
      />
    </div>
  );
}
