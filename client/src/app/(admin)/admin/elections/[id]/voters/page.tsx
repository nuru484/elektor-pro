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
import { useRouter } from "next/navigation";
import { use, useState } from "react";
import { toast } from "sonner";

import type { RollEntry } from "@/types/api";

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
import { Select as NativeSelect } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/states";
import { CellText, RowCard } from "@/components/ui/table-bits";
import { clearAllFiltersPatch } from "@/components/ui/table-empty-logic";
import { type TableFiltersSpec } from "@/hooks/table-query-state-logic";
import { useTableQueryState } from "@/hooks/use-table-query-state";
import { useAuthRole } from "@/hooks/use-auth-role";
import {
  useAccreditVoterMutation,
  useListRollQuery,
  useRemoveFromRollMutation,
  useRevokeAccreditationMutation,
  useSetRollEligibilityMutation,
} from "@/redux/admin-api";
import { getApiErrorMessage } from "@/utils/extract-api-error";

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
  const router = useRouter();
  const { can, isSuperAdmin } = useAuthRole();
  const canAccredit = can("ACCREDIT_VOTERS");
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
                    router.push(`/admin/elections/${electionId}/voters/add`);
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
                    router.push(`/admin/elections/${electionId}/voters/add`);
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

      {/* After a successful import the fastest path onto the roll is the
          add-voters page (by group). */}
      <VoterImportDialog
        key={importOpen ? "import-open" : "import-closed"}
        onClose={() => {
          setImportOpen(false);
        }}
        onDone={() => {
          router.push(`/admin/elections/${electionId}/voters/add`);
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
