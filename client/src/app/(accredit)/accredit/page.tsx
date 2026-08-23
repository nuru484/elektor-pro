"use client";

// The accreditation desk: pick an open election, look a voter up, see their
// standing at a glance, check them in - and where the election uses one-time
// codes, hand the code over. Built for the busy queue: search is debounced,
// statuses are unmissable, actions stack under the text on phones.
import {
  BadgeCheck,
  CalendarClock,
  CheckCircle2,
  ShieldX,
  UserRoundSearch,
  X,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import type { AccreditationSearchRow } from "@/types/api";

import { VoteCodeDialog } from "@/components/accreditation/code-dialog";
import { CardTitleRow } from "@/components/console/card-title-row";
import { EntityAvatar } from "@/components/console/entity-avatar";
import { ResultsAccessTab } from "@/components/console/results-access";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { Field } from "@/components/ui/field";
import { Input, Select as NativeSelect } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, PageHeader } from "@/components/ui/states";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatusBadge } from "@/components/ui/status-badge";
import { useDebounce } from "@/hooks/use-debounce";
import {
  useAccreditVoterMutation,
  useGetTurnoutQuery,
  useSearchAccreditationQuery,
} from "@/redux/admin-api";
import { useListMyDeskElectionsQuery } from "@/redux/governance-api";
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
  // Staff pick a desk; an accreditor has exactly one, so theirs is derived
  // rather than stored - nothing to sync, and no empty first render.
  const [pickedElectionId, setPickedElectionId] = useState("");
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search.trim(), 400);
  const [confirming, setConfirming] = useState<AccreditationSearchRow | null>(null);
  const [issuedCode, setIssuedCode] = useState<null | string>(null);
  const [codeVoter, setCodeVoter] = useState("");

  // An accreditor staffs ONE desk at a time (the server refuses a second
  // live posting), so there is nothing to search or filter here: their desk
  // is simply selected. Admins are not posted to a desk, so they still get a
  // picker over every open election. Either way the server re-checks the
  // scope on every call, so an unassigned election is unreachable rather
  // than merely unlisted.
  const { data: deskData, isLoading: electionsLoading } =
    useListMyDeskElectionsQuery();
  const desk = deskData?.data;
  const staffElections = desk?.staffElections;
  const isStaffDesk = staffElections !== undefined;
  const myDesk = desk?.current ?? null;
  const history = desk?.history ?? [];
  const elections = staffElections ?? (myDesk ? [myDesk] : []);

  const electionId = isStaffDesk ? pickedElectionId : (myDesk?.id ?? "");

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

      <Tabs className="gap-4" defaultValue="desk">
        <TabsList>
          <TabsTrigger value="desk">Desk</TabsTrigger>
          {!isStaffDesk && (
            <TabsTrigger value="history">History ({history.length})</TabsTrigger>
          )}
          <TabsTrigger value="results">Results</TabsTrigger>
        </TabsList>

        <TabsContent className="space-y-6" value="desk">
          <div className={isStaffDesk ? "grid gap-3 sm:grid-cols-[minmax(0,320px)_1fr]" : "grid gap-3"}>
            {isStaffDesk ? (
              <Field label="Election">
                <NativeSelect
                  disabled={elections.length === 0}
                  onChange={(e) => {
                    setPickedElectionId(e.target.value);
                  }}
                  title="Every election currently open for accreditation"
                  value={electionId}
                >
                  <option value="">
                    {electionsLoading
                      ? "Loading elections…"
                      : elections.length === 0
                        ? "No open elections"
                        : "Select an election…"}
                  </option>
                  {elections.map((election) => (
                    <option key={election.id} value={election.id}>
                      {election.name}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
            ) : myDesk ? (
              // The accreditor's single desk, stated rather than chosen.
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-card px-4 py-3">
                <div className="min-w-0">
                  <p className="text-[11px] font-medium text-muted-foreground">
                    Your desk
                  </p>
                  <p className="min-w-0 font-medium [overflow-wrap:anywhere]">
                    {myDesk.name}
                  </p>
                </div>
                <StatusBadge status={myDesk.status} />
              </div>
            ) : null}
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
              {/* Desk progress at a glance: how much of the eligible roll has
                  been accredited, and how much has gone on to vote. */}
              <div className="col-span-3 rounded-xl border border-border bg-card px-3 py-2.5">
                {[
                  { label: "Accredited", value: turnout.accredited },
                  { label: "Voted", value: turnout.voted },
                ].map((row) => {
                  const pct =
                    turnout.eligible === 0
                      ? 0
                      : Math.min((row.value / turnout.eligible) * 100, 100);
                  return (
                    <div className="mt-1.5 first:mt-0" key={row.label}>
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="text-[11px] font-medium text-muted-foreground">
                          {row.label}
                        </span>
                        <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
                          {pct.toFixed(1)}% of eligible
                        </span>
                      </div>
                      <div
                        aria-label={`${row.label}: ${pct.toFixed(1)}% of eligible voters`}
                        aria-valuemax={100}
                        aria-valuemin={0}
                        aria-valuenow={Math.round(pct)}
                        className="mt-1 h-1.5 overflow-hidden bg-muted"
                        role="progressbar"
                      >
                        <div
                          className="h-full bg-chart-1 transition-[width] duration-700"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
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
        </TabsContent>

        {!isStaffDesk && (
          <TabsContent value="history">
            {history.length === 0 ? (
              <EmptyState
                description="Elections you have staffed move here once they close, so you can always look back at the desks you have worked."
                icon={CalendarClock}
                title="Nothing in your history yet"
              />
            ) : (
              <ul className="grid gap-3 sm:grid-cols-2">
                {history.map((election) => (
                  <li
                    className="rounded-xl border border-border bg-card p-4"
                    key={election.id}
                  >
                    <CardTitleRow
                      tag={<StatusBadge status={election.status} />}
                      title={election.name}
                      titleClassName="text-sm font-medium"
                    />
                    <p className="mt-1 text-xs text-muted-foreground">
                      {formatDateTime(election.startDate)} to{" "}
                      {formatDateTime(election.endDate)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </TabsContent>
        )}

        <TabsContent value="results">
          <ResultsAccessTab
            elections={isStaffDesk ? elections : [...(myDesk ? [myDesk] : []), ...history]}
          />
        </TabsContent>
      </Tabs>

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
