"use client";

// Election workspace - Voters tab: the election roll. Voters land here by
// group or individually, can be excluded/re-enabled at any time, and can be
// removed outright only while their entry has no history (no vote, no
// accreditation) - the server refuses otherwise.
import { type ColumnDef, type Row } from "@tanstack/react-table";
import {
  BadgeCheck,
  CheckCircle2,
  FileUp,
  Plus,
  UserRoundX,
  UsersRound,
} from "lucide-react";
import Link from "next/link";
import { use, useState } from "react";
import { toast } from "sonner";

import type { RollEntry, Voter } from "@/types/api";

import { VoteCodeDialog } from "@/components/accreditation/code-dialog";
import { EntityAvatar } from "@/components/console/entity-avatar";
import { VoterImportDialog } from "@/components/console/import-dialog";
import { RowActionsMenu } from "@/components/console/row-actions";
import { FilterField, TableToolbar } from "@/components/console/table-toolbar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { DataTable, useDataTable } from "@/components/ui/data-table";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { Field } from "@/components/ui/field";
import { Input, Select as NativeSelect } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { EmptyState } from "@/components/ui/states";
import { CellText, RowCard } from "@/components/ui/table-bits";
import { clearAllFiltersPatch } from "@/components/ui/table-empty-logic";
import { type TableFiltersSpec } from "@/hooks/table-query-state-logic";
import { useTableQueryState } from "@/hooks/use-table-query-state";
import { useAuthRole } from "@/hooks/use-auth-role";
import {
  useAccreditVoterMutation,
  useAddToRollMutation,
  useGetElectionQuery,
  useListRollQuery,
  useListVotersQuery,
  useRemoveFromRollMutation,
  useRevokeAccreditationMutation,
  useSetRollEligibilityMutation,
} from "@/redux/admin-api";
import { useListGroupsQuery } from "@/redux/governance-api";
import { getApiErrorMessage } from "@/utils/extract-api-error";

// --- Add-voters modal: a whole group, hand-picked voters, or both ---

function AddVotersModal({
  electionId,
  onClose,
  open,
}: {
  electionId: string;
  onClose: () => void;
  open: boolean;
}) {
  const [addToRoll, { isLoading }] = useAddToRollMutation();
  const [groupId, setGroupId] = useState("");
  const [joinGroupId, setJoinGroupId] = useState("");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Voter[]>([]);

  const { data: groupsData } = useListGroupsQuery({ limit: 100 });
  const groups = groupsData?.data ?? [];
  const { data: electionData } = useGetElectionQuery(electionId);
  // For a group-scoped election, hand-picked voters can be enrolled into one
  // of its eligibility groups so they properly belong to the election's
  // category/group, not just its roll.
  const scopedGroups = (electionData?.data.eligibilityGroups ?? []).map(
    (entry) => entry.group,
  );
  const { data: votersData, isFetching: searching } = useListVotersQuery(
    // excludeElectionId: only voters not yet part of THIS election appear.
    { excludeElectionId: electionId, limit: 8, search },
    { skip: search.length < 2 },
  );
  const matches = (votersData?.data ?? []).filter(
    (voter) => !selected.some((s) => s.id === voter.id),
  );

  const submit = async () => {
    if (!groupId && selected.length === 0) {
      toast.error("Pick a group or select voters first");
      return;
    }
    try {
      const res = await addToRoll({
        electionId,
        ...(groupId ? { groupId } : {}),
        ...(joinGroupId ? { joinGroupId } : {}),
        ...(selected.length ? { voterIds: selected.map((v) => v.id) } : {}),
      }).unwrap();
      const { added, alreadyEligible, joinedGroup, reEnabled } = res.data;
      toast.success(
        `${String(added)} added${reEnabled ? `, ${String(reEnabled)} re-enabled` : ""}${
          alreadyEligible ? `, ${String(alreadyEligible)} already on the roll` : ""
        }${joinedGroup ? `, ${String(joinedGroup)} joined the group` : ""}`,
      );
      onClose();
    } catch (error) {
      toast.error(getApiErrorMessage(error));
    }
  };

  return (
    <Modal
      description="Add a whole group, hand-pick voters, or both at once. Only voters not yet in this election show up in the search."
      onClose={onClose}
      open={open}
      title="Add voters to the roll"
    >
      <div className="space-y-4">
        <Field hint="Every voter in the group joins the roll." label="Whole group">
          <NativeSelect
            onChange={(e) => {
              setGroupId(e.target.value);
            }}
            title="Adds every member of the chosen group to this election's roll"
            value={groupId}
          >
            <option value="">No group</option>
            {groups.map((group) => (
              <option key={group.id} value={group.id}>
                {group.category ? `${group.category.name} · ` : ""}
                {group.name}
              </option>
            ))}
          </NativeSelect>
        </Field>

        <Field
          hint="Search by name, voter ID, or phone. Voters already in this election are hidden."
          label="Individual voters"
        >
          <Input
            onChange={(e) => {
              setSearch(e.target.value);
            }}
            placeholder="Type at least 2 characters…"
            title="Find registered voters who are not yet part of this election"
            value={search}
          />
        </Field>
        {search.length >= 2 && (
          <div className="max-h-44 space-y-1 overflow-y-auto rounded-lg border border-border p-1.5">
            {searching && <p className="px-2 py-1 text-xs text-muted-foreground">Searching…</p>}
            {!searching && matches.length === 0 && (
              <p className="px-2 py-1 text-xs text-muted-foreground">No matching voters.</p>
            )}
            {matches.map((voter) => (
              <button
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent"
                key={voter.id}
                onClick={() => {
                  setSelected((prev) => [...prev, voter]);
                }}
                type="button"
              >
                <EntityAvatar name={voter.name} size="size-6" url={voter.profilePicture} />
                <span className="min-w-0 truncate">{voter.name}</span>
                <span className="ml-auto shrink-0 font-mono text-xs text-muted-foreground">
                  {voter.voterId}
                </span>
              </button>
            ))}
          </div>
        )}
        {selected.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {selected.map((voter) => (
              <button
                className="inline-flex max-w-full items-center gap-1 rounded-full border border-border px-2.5 py-1 text-xs hover:border-destructive/50"
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

        <Button className="w-full" loading={isLoading} onClick={submit} variant="brand">
          Add to roll
        </Button>
      </div>
    </Modal>
  );
}

// --- The roll table ---

interface RollFilters extends Record<string, string | undefined> {
  accredited?: string;
  eligible?: string;
  search?: string;
  voted?: string;
}

const FILTERS_SPEC: TableFiltersSpec<RollFilters> = {
  accredited: { kind: "enum", values: ["true", "false"] },
  eligible: { kind: "enum", values: ["true", "false"] },
  search: { kind: "string" },
  voted: { kind: "enum", values: ["true", "false"] },
};

const boolFilter = (
  caption: string,
  labels: [string, string],
  value: string | undefined,
  onChange: (next: string | undefined) => void,
) => (
  <FilterField caption={caption}>
    <NativeSelect
      className="w-full lg:w-36"
      onChange={(e) => {
        onChange(e.target.value === "all" ? undefined : e.target.value);
      }}
      value={value ?? "all"}
    >
      <option value="all">All</option>
      <option value="true">{labels[0]}</option>
      <option value="false">{labels[1]}</option>
    </NativeSelect>
  </FilterField>
);

export default function ElectionRollPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: electionId } = use(params);
  const { can, isSuperAdmin } = useAuthRole();
  const canAccredit = can("ACCREDIT_VOTERS");
  const [addOpen, setAddOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [removing, setRemoving] = useState<null | RollEntry>(null);
  const [issuedCode, setIssuedCode] = useState<null | string>(null);
  const [codeVoter, setCodeVoter] = useState("");
  const [setEligibility] = useSetRollEligibilityMutation();
  const [removeFromRoll] = useRemoveFromRollMutation();
  const [accredit] = useAccreditVoterMutation();
  const [revokeAccreditation] = useRevokeAccreditationMutation();

  const doAccredit = async (entry: RollEntry) => {
    try {
      const res = await accredit({ electionId, voterId: entry.voter.id }).unwrap();
      toast.success(`${entry.voter.name} accredited`);
      if (res.data.voteCode) {
        setCodeVoter(entry.voter.name);
        setIssuedCode(res.data.voteCode);
      }
    } catch (error) {
      toast.error(getApiErrorMessage(error));
    }
  };

  const doRevokeAccreditation = async (entry: RollEntry) => {
    try {
      await revokeAccreditation({ electionId, voterId: entry.voter.id }).unwrap();
      toast.success("Accreditation revoked");
    } catch (error) {
      toast.error(getApiErrorMessage(error));
    }
  };

  const {
    filters,
    handleFiltersChange,
    handlePageChange,
    handlePageSizeChange,
    page,
    pageSize,
    queryParams,
  } = useTableQueryState<RollFilters>({ spec: FILTERS_SPEC });

  const { data, isFetching, isLoading } = useListRollQuery({
    ...queryParams,
    electionId,
  });
  const rows = data?.data ?? [];
  const totalCount = data?.meta.total ?? 0;

  const toggleEligibility = async (entry: RollEntry) => {
    try {
      await setEligibility({
        electionId,
        isEligible: !entry.isEligible,
        voterId: entry.voter.id,
      }).unwrap();
      toast.success(entry.isEligible ? "Voter excluded" : "Voter marked eligible");
    } catch (error) {
      toast.error(getApiErrorMessage(error));
    }
  };

  const columns: ColumnDef<RollEntry>[] = [
    {
      cell: ({ row }) => (
        <div className="flex min-w-0 items-center gap-2.5">
          <EntityAvatar
            name={row.original.voter.name}
            url={row.original.voter.profilePicture}
          />
          <div className="min-w-0 flex-1">
            <Link
              className="block max-w-[90%] truncate text-sm font-medium hover:text-brand"
              href={`/admin/voters/${row.original.voter.id}`}
              title={row.original.voter.name}
            >
              {row.original.voter.name}
            </Link>
            <p className="truncate font-mono text-xs text-muted-foreground">
              {row.original.voter.voterId}
            </p>
          </div>
        </div>
      ),
      header: "Voter",
      id: "voter",
      meta: { stretch: true },
    },
    {
      cell: ({ row }) => (
        <CellText
          className="max-w-44 text-xs text-muted-foreground"
          text={
            (row.original.voter.groupMemberships ?? [])
              .map(({ group }) => group.name)
              .join(", ") || "—"
          }
        />
      ),
      header: "Groups",
      id: "groups",
    },
    {
      cell: ({ row }) =>
        row.original.isEligible ? (
          <Badge variant="success">Eligible</Badge>
        ) : (
          <Badge variant="destructive">Excluded</Badge>
        ),
      header: "Eligibility",
      id: "eligibility",
    },
    {
      cell: ({ row }) => (
        <span className="text-xs text-muted-foreground">
          {row.original.accreditedAt ? "Accredited" : "—"}
        </span>
      ),
      header: "Accredited",
      id: "accredited",
    },
    {
      cell: ({ row }) =>
        row.original.hasVoted ? (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-success">
            <CheckCircle2 className="size-3.5" /> Voted
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">Not yet</span>
        ),
      header: "Voted",
      id: "voted",
    },
    {
      cell: ({ row }) => {
        const entry = row.original;
        const hasHistory = entry.hasVoted || entry.accreditedAt !== null;
        return (
          <RowActionsMenu label="Roll actions">
            {canAccredit && entry.isEligible && !entry.hasVoted && (
              <DropdownMenuItem
                onClick={() => {
                  void doAccredit(entry);
                }}
              >
                <BadgeCheck className="size-4" />
                {entry.accreditedAt ? "Re-accredit" : "Accredit"}
              </DropdownMenuItem>
            )}
            {isSuperAdmin && entry.accreditedAt && !entry.hasVoted && (
              <DropdownMenuItem
                onClick={() => {
                  void doRevokeAccreditation(entry);
                }}
              >
                <UserRoundX className="size-4" /> Revoke accreditation
              </DropdownMenuItem>
            )}
            <DropdownMenuItem
              onClick={() => {
                void toggleEligibility(entry);
              }}
            >
              {entry.isEligible ? (
                <>
                  <UserRoundX className="size-4" /> Exclude
                </>
              ) : (
                <>
                  <CheckCircle2 className="size-4" /> Re-enable
                </>
              )}
            </DropdownMenuItem>
            {!hasHistory && (
              <DropdownMenuItem
                onClick={() => {
                  setRemoving(entry);
                }}
                variant="destructive"
              >
                <UserRoundX className="size-4" /> Remove from roll
              </DropdownMenuItem>
            )}
          </RowActionsMenu>
        );
      },
      header: "Actions",
      id: "actions",
    },
  ];

  const table = useDataTable({
    columns,
    data: rows,
    enableRowSelection: false,
    getRowId: (row) => row.id,
    pageSize,
    totalCount,
  });

  return (
    <>
      <DataTable
        emptyState={
          <EmptyState
            action={
              <div className="flex flex-wrap justify-center gap-2">
                <Button
                  onClick={() => {
                    setAddOpen(true);
                  }}
                  variant="brand"
                >
                  <Plus className="size-4" /> Add voters
                </Button>
                <Button
                  onClick={() => {
                    setImportOpen(true);
                  }}
                  variant="outline"
                >
                  <FileUp className="size-4" /> Import file
                </Button>
              </div>
            }
            description="Build the roll by adding groups or individual voters. Roll entries also track accreditation and turnout."
            icon={UsersRound}
            title="Nobody on the roll yet"
          />
        }
        entityLabel="roll entries"
        filters={filters}
        loading={isLoading || isFetching}
        onClearFilters={() => {
          handleFiltersChange(clearAllFiltersPatch(filters));
        }}
        onPageChange={handlePageChange}
        onPageSizeChange={handlePageSizeChange}
        page={page}
        pageSize={pageSize}
        renderRowCard={(row: Row<RollEntry>) => (
          <RowCard key={row.id}>
            <div className="flex items-center justify-between gap-2">
              <span className="flex min-w-0 items-center gap-2">
                <EntityAvatar
                  name={row.original.voter.name}
                  size="size-7"
                  url={row.original.voter.profilePicture}
                />
                <span className="min-w-0 truncate text-sm font-medium">
                  {row.original.voter.name}
                </span>
              </span>
              {row.original.isEligible ? (
                <Badge variant="success">Eligible</Badge>
              ) : (
                <Badge variant="destructive">Excluded</Badge>
              )}
            </div>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              {row.original.voter.voterId}
              {row.original.hasVoted ? " · voted" : ""}
              {row.original.accreditedAt ? " · accredited" : ""}
            </p>
          </RowCard>
        )}
        table={table}
        toolbar={
          <TableToolbar
            actions={
              <>
                <Button
                  onClick={() => {
                    setImportOpen(true);
                  }}
                  variant="outline"
                >
                  <FileUp className="size-4" /> Import
                </Button>
                <Button
                  onClick={() => {
                    setAddOpen(true);
                  }}
                  variant="brand"
                >
                  <Plus className="size-4" /> Add voters
                </Button>
              </>
            }
            filters={filters}
            onClear={() => {
              handleFiltersChange(clearAllFiltersPatch(filters));
            }}
            onSearchChange={(value) => {
              handleFiltersChange({ search: value || undefined });
            }}
            search={filters.search ?? ""}
            searchPlaceholder="Search the roll…"
          >
            {boolFilter("Eligibility", ["Eligible", "Excluded"], filters.eligible, (v) => {
              handleFiltersChange({ eligible: v });
            })}
            {boolFilter("Accredited", ["Yes", "No"], filters.accredited, (v) => {
              handleFiltersChange({ accredited: v });
            })}
            {boolFilter("Voted", ["Yes", "No"], filters.voted, (v) => {
              handleFiltersChange({ voted: v });
            })}
          </TableToolbar>
        }
        totalCount={totalCount}
      />

      <AddVotersModal
        electionId={electionId}
        key={addOpen ? "open" : "closed"}
        onClose={() => {
          setAddOpen(false);
        }}
        open={addOpen}
      />
      {/* After a successful import the fastest path onto the roll is the
          Add voters modal (by group). */}
      <VoterImportDialog
        key={importOpen ? "import-open" : "import-closed"}
        onClose={() => {
          setImportOpen(false);
        }}
        onDone={() => {
          setAddOpen(true);
        }}
        open={importOpen}
      />
      <VoteCodeDialog
        code={issuedCode}
        onClose={() => {
          setIssuedCode(null);
        }}
        voterName={codeVoter}
      />
      <ConfirmationDialog
        confirmText="Remove"
        description={`"${removing?.voter.name ?? ""}" will be taken off this election's roll.`}
        isDestructive
        onConfirm={async () => {
          if (!removing) return;
          setRemoving(null);
          try {
            await removeFromRoll({ electionId, voterId: removing.voter.id }).unwrap();
            toast.success("Removed from the roll");
          } catch (error) {
            toast.error(getApiErrorMessage(error));
          }
        }}
        onOpenChange={(open) => {
          if (!open) setRemoving(null);
        }}
        open={removing !== null}
        title="Remove from the roll?"
      />
    </>
  );
}
