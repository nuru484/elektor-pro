"use client";

// Add voters to an election's roll, as a full page: pick a group and see who
// is in it (not just a blind "add the whole group"), search the register, or
// both. Only voters not yet part of this election are offered. Saving
// returns to the election's Voters tab.
import { Plus, UserRoundPlus, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { use, useState } from "react";
import { toast } from "sonner";

import type { Voter } from "@/types/api";

import { EntityAvatar } from "@/components/console/entity-avatar";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input, Select as NativeSelect } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/states";
import { useDebounce } from "@/hooks/use-debounce";
import {
  useAddToRollMutation,
  useGetElectionQuery,
  useListVotersQuery,
} from "@/redux/admin-api";
import { useListGroupsQuery } from "@/redux/governance-api";
import { getApiErrorMessage } from "@/utils/extract-api-error";
import { BorderedListSkeleton } from "@/components/console/skeletons";

function VoterRow({
  onPick,
  voter,
}: {
  onPick: (voter: Voter) => void;
  voter: Voter;
}) {
  return (
    <button
      className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent"
      onClick={() => {
        onPick(voter);
      }}
      title="Add this voter to the selection"
      type="button"
    >
      <EntityAvatar name={voter.name} size="size-6" url={voter.profilePicture} />
      <span className="min-w-0 truncate">{voter.name}</span>
      <span className="ml-auto min-w-0 max-w-[45%] shrink-0 truncate font-mono text-xs text-muted-foreground">
        {voter.voterId}
      </span>
      <Plus className="size-3.5 shrink-0 text-muted-foreground" />
    </button>
  );
}

export default function AddVotersPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: electionId } = use(params);
  const router = useRouter();
  const [addToRoll, { isLoading: saving }] = useAddToRollMutation();

  const [groupId, setGroupId] = useState("");
  const [wholeGroup, setWholeGroup] = useState(false);
  const [joinGroupId, setJoinGroupId] = useState("");
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search.trim(), 400);
  const [selected, setSelected] = useState<Voter[]>([]);

  const { data: groupsData } = useListGroupsQuery({ limit: 100 });
  const groups = groupsData?.data ?? [];
  const { data: electionData } = useGetElectionQuery(electionId);
  const election = electionData?.data;
  const scopedGroups = (election?.eligibilityGroups ?? []).map((e) => e.group);

  // Members of the chosen group who are NOT yet in this election.
  const { data: groupVoters, isFetching: loadingGroup } = useListVotersQuery(
    { excludeElectionId: electionId, groupId, limit: 8 },
    { skip: !groupId },
  );
  // Search across everyone not yet in this election.
  const { data: searchVoters, isFetching: searching } = useListVotersQuery(
    { excludeElectionId: electionId, limit: 8, search: debouncedSearch },
    { skip: debouncedSearch.length < 2 },
  );

  const pick = (voter: Voter) => {
    setSelected((prev) =>
      prev.some((v) => v.id === voter.id) ? prev : [...prev, voter],
    );
  };
  const notSelected = (voters: Voter[] | undefined) =>
    (voters ?? []).filter((voter) => !selected.some((v) => v.id === voter.id));

  const save = async () => {
    if (!(wholeGroup && groupId) && selected.length === 0) {
      toast.error("Select voters, or tick 'add the whole group'");
      return;
    }
    try {
      const res = await addToRoll({
        electionId,
        ...(wholeGroup && groupId ? { groupId } : {}),
        ...(joinGroupId ? { joinGroupId } : {}),
        ...(selected.length ? { voterIds: selected.map((v) => v.id) } : {}),
      }).unwrap();
      const { added, alreadyEligible, joinedGroup, reEnabled } = res.data;
      toast.success(
        `${String(added)} added${reEnabled ? `, ${String(reEnabled)} re-enabled` : ""}${
          alreadyEligible ? `, ${String(alreadyEligible)} already on the roll` : ""
        }${joinedGroup ? `, ${String(joinedGroup)} joined the group` : ""}`,
      );
      router.push(`/admin/elections/${electionId}/voters`);
    } catch (error) {
      toast.error(getApiErrorMessage(error));
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        backHref={`/admin/elections/${electionId}/voters`}
        backLabel="Back to the roll"
        description="Pick a group to see its members, search the register, or both. Only voters not yet in this election are offered."
        title="Add voters"
      />

      <div className="max-w-2xl space-y-5 sm:rounded-xl sm:border sm:border-border sm:bg-card sm:p-6">
        <Field
          hint="Members not yet in this election appear below for hand-picking."
          label="From a group"
        >
          <NativeSelect
            onChange={(e) => {
              setGroupId(e.target.value);
              setWholeGroup(false);
            }}
            title="Browse a group's members"
            value={groupId}
          >
            <option value="">Choose a group…</option>
            {groups.map((group) => (
              <option key={group.id} value={group.id}>
                {group.category ? `${group.category.name} · ` : ""}
                {group.name}
              </option>
            ))}
          </NativeSelect>
        </Field>

        {groupId && (
          <div className="space-y-2">
            {loadingGroup ? (
              <BorderedListSkeleton avatar rows={3} />
            ) : (
              <div className="max-h-56 space-y-1 overflow-y-auto rounded-lg border border-border p-1.5">
                {notSelected(groupVoters?.data).length === 0 ? (
                  <p className="px-2 py-1 text-xs text-muted-foreground">
                    Every member of this group is already in the election.
                  </p>
                ) : (
                  notSelected(groupVoters?.data).map((voter) => (
                    <VoterRow key={voter.id} onPick={pick} voter={voter} />
                  ))
                )}
              </div>
            )}
            {(groupVoters?.meta.total ?? 0) > 8 && (
              <p className="text-xs text-muted-foreground">
                Showing the first 8 of {groupVoters?.meta.total} members not yet
                in this election. Use the search to find a specific person, or
                tick below to add everyone.
              </p>
            )}
            <label className="flex items-center gap-2 text-sm" title="Adds every member of the group to the roll, including those not shown above">
              <input
                checked={wholeGroup}
                className="size-4 accent-brand"
                onChange={(e) => {
                  setWholeGroup(e.target.checked);
                }}
                type="checkbox"
              />
              Add the whole group ({groupVoters?.meta.total ?? 0} not yet in)
            </label>
          </div>
        )}

        <Field
          hint="Name, voter ID, or phone. Voters already in this election are hidden."
          label="Search the register"
        >
          <div className="relative">
            <Input
              className="pr-9"
              onChange={(e) => {
                setSearch(e.target.value);
              }}
              placeholder="Type at least 2 characters…"
              title="Find voters who are not yet part of this election"
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
        {debouncedSearch.length >= 2 && (
          <div className="max-h-44 space-y-1 overflow-y-auto rounded-lg border border-border p-1.5">
            {searching && (
              <p className="px-2 py-1 text-xs text-muted-foreground">Searching…</p>
            )}
            {!searching && notSelected(searchVoters?.data).length === 0 && (
              <p className="px-2 py-1 text-xs text-muted-foreground">
                No matching voters outside this election.
              </p>
            )}
            {notSelected(searchVoters?.data).map((voter) => (
              <VoterRow key={voter.id} onPick={pick} voter={voter} />
            ))}
          </div>
        )}

        {selected.length > 0 && (
          <Field label={`Selected (${String(selected.length)})`}>
            <div className="flex flex-wrap gap-1.5">
              {selected.map((voter) => (
                <button
                  className="inline-flex max-w-full items-center gap-1 border border-border px-2.5 py-1 text-xs hover:border-destructive/50"
                  key={voter.id}
                  onClick={() => {
                    setSelected((prev) => prev.filter((v) => v.id !== voter.id));
                  }}
                  title="Remove from selection"
                  type="button"
                >
                  <span className="min-w-0 truncate">{voter.name}</span>
                  <span aria-hidden>×</span>
                </button>
              ))}
            </div>
          </Field>
        )}

        {scopedGroups.length > 0 && (
          <Field
            hint="This election is group-scoped: enrolling the added voters into one of its groups makes them belong to that category/group, not just this roll."
            label="Also enrol them in"
          >
            <NativeSelect
              onChange={(e) => {
                setJoinGroupId(e.target.value);
              }}
              title="Optionally place the added voters into one of this election's eligibility groups"
              value={joinGroupId}
            >
              <option value="">Roll only (no group change)</option>
              {scopedGroups.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.name}
                </option>
              ))}
            </NativeSelect>
          </Field>
        )}

        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            onClick={() => {
              router.push(`/admin/elections/${electionId}/voters`);
            }}
            type="button"
            variant="outline"
          >
            Cancel
          </Button>
          <Button loading={saving} onClick={() => void save()} variant="brand">
            <UserRoundPlus className="size-4" /> Add to the roll
          </Button>
        </div>
      </div>
    </div>
  );
}
