"use client";

// Election workspace - Portfolios tab: the contested positions on this
// election's ballot, managed in place (maker-checker aware).
import { type ColumnDef, type Row } from "@tanstack/react-table";
import { Briefcase, Pencil, Plus, Trash2 } from "lucide-react";
import { use, useState } from "react";
import { toast } from "sonner";

import type { Portfolio, PortfolioEligibilityMode, VotingMethod } from "@/types/api";

import { GroupPicker } from "@/components/elections/group-picker";
import { RowActionsMenu } from "@/components/console/row-actions";
import { TableToolbar } from "@/components/console/table-toolbar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { DataTable, useDataTable } from "@/components/ui/data-table";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { Field } from "@/components/ui/field";
import { Input, Select as NativeSelect, Textarea } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { EmptyState } from "@/components/ui/states";
import { CellText, RowCard } from "@/components/ui/table-bits";
import { useAuthRole } from "@/hooks/use-auth-role";
import { type TableFiltersSpec } from "@/hooks/table-query-state-logic";
import { useTableQueryState } from "@/hooks/use-table-query-state";
import {
  useCreatePortfolioMutation,
  useDeletePortfolioMutation,
  useListPortfoliosQuery,
  useUpdatePortfolioMutation,
} from "@/redux/admin-api";
import { getApiErrorMessage } from "@/utils/extract-api-error";
import { type FormErrors, validateRequired } from "@/utils/form-validate";

const VOTING_METHOD_LABELS: Record<VotingMethod, string> = {
  MULTI_SELECT: "Multi select",
  SINGLE_CHOICE: "Single choice",
  YES_NO: "Yes / No",
};

const ELIGIBILITY_LABELS: Record<string, string> = {
  ALL_OF_GROUPS: "All selected groups",
  ALL_VOTERS: "Every eligible voter",
  ANY_OF_GROUPS: "Any selected group",
};

const pendingToast = (res: unknown, applied: string) => {
  toast.success(
    (res as { pending?: boolean }).pending ? "Submitted for approval" : applied,
  );
};

function PortfolioModal({
  electionId,
  onClose,
  open,
  portfolio,
}: {
  electionId: string;
  onClose: () => void;
  open: boolean;
  portfolio: null | Portfolio;
}) {
  const [create, { isLoading: creating }] = useCreatePortfolioMutation();
  const [update, { isLoading: updating }] = useUpdatePortfolioMutation();
  const [errors, setErrors] = useState<FormErrors>({});
  const [votingMethod, setVotingMethod] = useState<VotingMethod>(
    portfolio?.votingMethod ?? "SINGLE_CHOICE",
  );
  const [eligibility, setEligibility] = useState<PortfolioEligibilityMode>(
    (portfolio?.eligibility as PortfolioEligibilityMode | undefined) ?? "ALL_VOTERS",
  );
  const [groupIds, setGroupIds] = useState<string[]>(
    portfolio?.eligibilityGroups?.map(({ group }) => group.id) ?? [],
  );

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const errs = validateRequired(f, { name: "Name" });
    if (eligibility !== "ALL_VOTERS" && groupIds.length === 0) {
      errs.groups = "Select at least one group";
    }
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    const maxSelectionsRaw = String(f.get("maxSelections") ?? "");
    const body = {
      allowAbstain: f.get("allowAbstain") === "on",
      description: f.get("description") || undefined,
      electionId,
      eligibility,
      groupIds: eligibility === "ALL_VOTERS" ? [] : groupIds,
      maxSelections:
        votingMethod === "MULTI_SELECT" && maxSelectionsRaw
          ? Number(maxSelectionsRaw)
          : 1,
      name: f.get("name"),
      votingMethod,
    };
    try {
      const res = portfolio
        ? await update({ data: body, id: portfolio.id }).unwrap()
        : await create(body).unwrap();
      pendingToast(res, portfolio ? "Portfolio updated" : "Portfolio created");
      onClose();
    } catch (error) {
      toast.error(getApiErrorMessage(error));
    }
  };

  return (
    <Modal
      description="A position voters decide on this ballot."
      onClose={onClose}
      open={open}
      title={portfolio ? "Edit portfolio" : "New portfolio"}
    >
      <form className="space-y-4" noValidate onSubmit={onSubmit}>
        <Field error={errors.name} label="Name">
          <Input
            defaultValue={portfolio?.name ?? ""}
            name="name"
            placeholder="e.g. President"
            required
          />
        </Field>
        <Field label="Description">
          <Textarea
            defaultValue={portfolio?.description ?? ""}
            name="description"
            placeholder="What this position is responsible for (optional)"
          />
        </Field>
        <div className="grid grid-cols-1 gap-3 min-[360px]:grid-cols-2">
          <Field label="Voting method">
            <NativeSelect
              onChange={(e) => {
                setVotingMethod(e.target.value as VotingMethod);
              }}
              value={votingMethod}
            >
              <option value="SINGLE_CHOICE">Single choice</option>
              <option value="MULTI_SELECT">Multi select</option>
              <option value="YES_NO">Yes / No</option>
            </NativeSelect>
          </Field>
          {votingMethod === "MULTI_SELECT" && (
            <Field hint="How many candidates a voter may pick." label="Max selections">
              <Input
                defaultValue={portfolio?.maxSelections ?? 2}
                min={1}
                name="maxSelections"
                type="number"
              />
            </Field>
          )}
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            className="size-4 accent-brand"
            defaultChecked={portfolio?.allowAbstain ?? true}
            name="allowAbstain"
            type="checkbox"
          />
          Voters may abstain on this portfolio
        </label>
        <Field
          hint="Scope this position to part of the electorate, or leave it open."
          label="Who votes on this position"
        >
          <NativeSelect
            onChange={(e) => {
              setEligibility(e.target.value as PortfolioEligibilityMode);
            }}
            value={eligibility}
          >
            <option value="ALL_VOTERS">Every eligible voter</option>
            <option value="ANY_OF_GROUPS">Voters in any selected group</option>
            <option value="ALL_OF_GROUPS">Voters in all selected groups</option>
          </NativeSelect>
        </Field>
        {eligibility !== "ALL_VOTERS" && (
          <GroupPicker error={errors.groups} onChange={setGroupIds} value={groupIds} />
        )}
        <Button className="w-full" loading={creating || updating} type="submit" variant="brand">
          {portfolio ? "Save changes" : "Create portfolio"}
        </Button>
      </form>
    </Modal>
  );
}

interface PortfolioFilters extends Record<string, string | undefined> {
  search?: string;
}

const FILTERS_SPEC: TableFiltersSpec<PortfolioFilters> = {
  search: { kind: "string" },
};

export default function ElectionPortfoliosPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: electionId } = use(params);
  const { isSuperAdmin } = useAuthRole();
  const [modal, setModal] = useState<{ open: boolean; portfolio: null | Portfolio }>({
    open: false,
    portfolio: null,
  });
  const [deleting, setDeleting] = useState<null | Portfolio>(null);
  const [deletePortfolio] = useDeletePortfolioMutation();

  const {
    filters,
    handleFiltersChange,
    handlePageChange,
    handlePageSizeChange,
    page,
    pageSize,
    queryParams,
  } = useTableQueryState<PortfolioFilters>({ spec: FILTERS_SPEC });

  const { data, isFetching, isLoading } = useListPortfoliosQuery({
    ...queryParams,
    electionId,
  });
  // The portfolios list endpoint has no search param; filter the page locally.
  const search = (filters.search ?? "").toLowerCase();
  const rows = (data?.data ?? []).filter(
    (portfolio) => !search || portfolio.name.toLowerCase().includes(search),
  );
  const totalCount = data?.meta.total ?? 0;

  const columns: ColumnDef<Portfolio>[] = [
    {
      accessorKey: "name",
      cell: ({ row }) => (
        <div className="min-w-0">
          <CellText className="max-w-[90%] text-sm font-medium" text={row.original.name} />
          <p className="truncate text-xs text-muted-foreground">
            {row.original._count?.candidates ?? 0} candidates
          </p>
        </div>
      ),
      header: "Portfolio",
      meta: { stretch: true },
    },
    {
      cell: ({ row }) => (
        <Badge variant="outline">{VOTING_METHOD_LABELS[row.original.votingMethod]}</Badge>
      ),
      header: "Method",
      id: "method",
    },
    {
      cell: ({ row }) => {
        const groups =
          row.original.eligibility !== "ALL_VOTERS" &&
          row.original.eligibilityGroups?.length
            ? `: ${row.original.eligibilityGroups.map(({ group }) => group.name).join(", ")}`
            : "";
        const label = `${ELIGIBILITY_LABELS[row.original.eligibility] ?? row.original.eligibility}${groups}`;
        return <CellText className="max-w-52 text-xs text-muted-foreground" text={label} />;
      },
      header: "Who votes",
      id: "eligibility",
    },
    {
      cell: ({ row }) => (
        <RowActionsMenu label="Portfolio actions">
          <DropdownMenuItem
            onClick={() => {
              setModal({ open: true, portfolio: row.original });
            }}
          >
            <Pencil className="size-4" /> Edit
          </DropdownMenuItem>
          {isSuperAdmin && (
            <DropdownMenuItem
              onClick={() => {
                setDeleting(row.original);
              }}
              variant="destructive"
            >
              <Trash2 className="size-4" /> Delete
            </DropdownMenuItem>
          )}
        </RowActionsMenu>
      ),
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
              <Button
                onClick={() => {
                  setModal({ open: true, portfolio: null });
                }}
                variant="brand"
              >
                <Plus className="size-4" /> New portfolio
              </Button>
            }
            description="Add the positions voters will decide - President, Secretary, and so on."
            icon={Briefcase}
            title="No portfolios yet"
          />
        }
        entityLabel="portfolios"
        filters={filters}
        loading={isLoading || isFetching}
        onClearFilters={() => {
          handleFiltersChange({ search: undefined });
        }}
        onPageChange={handlePageChange}
        onPageSizeChange={handlePageSizeChange}
        page={page}
        pageSize={pageSize}
        renderRowCard={(row: Row<Portfolio>) => (
          <RowCard
            key={row.id}
            onOpen={() => {
              setModal({ open: true, portfolio: row.original });
            }}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="min-w-0 truncate text-sm font-medium">
                {row.original.name}
              </span>
              <Badge variant="outline">
                {VOTING_METHOD_LABELS[row.original.votingMethod]}
              </Badge>
            </div>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              {row.original._count?.candidates ?? 0} candidates ·{" "}
              {ELIGIBILITY_LABELS[row.original.eligibility] ?? row.original.eligibility}
            </p>
          </RowCard>
        )}
        table={table}
        toolbar={
          <TableToolbar
            actions={
              <Button
                onClick={() => {
                  setModal({ open: true, portfolio: null });
                }}
                variant="brand"
              >
                <Plus className="size-4" /> New portfolio
              </Button>
            }
            filters={filters}
            onClear={() => {
              handleFiltersChange({ search: undefined });
            }}
            onSearchChange={(value) => {
              handleFiltersChange({ search: value || undefined });
            }}
            search={filters.search ?? ""}
            searchPlaceholder="Search portfolios…"
          />
        }
        totalCount={totalCount}
      />

      <PortfolioModal
        electionId={electionId}
        key={modal.portfolio?.id ?? (modal.open ? "new" : "closed")}
        onClose={() => {
          setModal({ open: false, portfolio: null });
        }}
        open={modal.open}
        portfolio={modal.portfolio}
      />
      <ConfirmationDialog
        confirmText="Delete portfolio"
        description={`"${deleting?.name ?? ""}" and its ballot entries will be removed from this election.`}
        isDestructive
        onConfirm={async () => {
          if (!deleting) return;
          setDeleting(null);
          try {
            const res = await deletePortfolio(deleting.id).unwrap();
            pendingToast(res, "Portfolio deleted");
          } catch (error) {
            toast.error(getApiErrorMessage(error));
          }
        }}
        onOpenChange={(open) => {
          if (!open) setDeleting(null);
        }}
        open={deleting !== null}
        requireExactMatch="delete"
        title="Delete this portfolio?"
      />
    </>
  );
}
