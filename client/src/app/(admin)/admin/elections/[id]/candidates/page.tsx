"use client";

// Election workspace - Candidates tab: everyone contesting in this election.
// Rows link to the full candidate profile; creation uses the standard
// nomination page.
import { type ColumnDef, type Row } from "@tanstack/react-table";
import { Eye, FileUp, Hash, Pencil, Plus, UserRound } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { use, useState } from "react";
import { toast } from "sonner";

import type { Candidate, CandidateStatus } from "@/types/api";

import { CANDIDATE_STATUS_LABELS } from "@/components/candidates/candidate-lifecycle";
import { EntityAvatar } from "@/components/console/entity-avatar";
import { CandidateImportDialog } from "@/components/console/import-dialog";
import { RowActionsMenu } from "@/components/console/row-actions";
import { FilterField, TableToolbar } from "@/components/console/table-toolbar";
import { Button } from "@/components/ui/button";
import { DataTable, useDataTable } from "@/components/ui/data-table";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { Field } from "@/components/ui/field";
import { Input, Select as NativeSelect } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { EmptyState } from "@/components/ui/states";
import { StatusBadge } from "@/components/ui/status-badge";
import { CellText, RowCard } from "@/components/ui/table-bits";
import { clearAllFiltersPatch } from "@/components/ui/table-empty-logic";
import { type TableFiltersSpec } from "@/hooks/table-query-state-logic";
import { useTableQueryState } from "@/hooks/use-table-query-state";
import {
  useListCandidatesQuery,
  useListPortfoliosQuery,
  useSetBallotNumberMutation,
} from "@/redux/admin-api";
import { getApiErrorMessage } from "@/utils/extract-api-error";

const STATUSES: CandidateStatus[] = [
  "DRAFT",
  "UNDER_REVIEW",
  "QUALIFIED",
  "DISQUALIFIED",
  "WITHDRAWN",
];

interface CandidateFilters extends Record<string, string | undefined> {
  portfolioId?: string;
  search?: string;
  status?: string;
}

const FILTERS_SPEC: TableFiltersSpec<CandidateFilters> = {
  portfolioId: { kind: "string" },
  search: { kind: "string" },
  status: { kind: "enum", values: STATUSES },
};

/** Manual ballot-number assignment for one candidate. */
function BallotNumberModal({
  candidate,
  onClose,
}: {
  candidate: Candidate | null;
  onClose: () => void;
}) {
  const [setBallotNumber, { isLoading }] = useSetBallotNumberMutation();
  const [value, setValue] = useState(
    candidate?.ballotNumber == null ? "" : String(candidate.ballotNumber),
  );

  const save = async () => {
    if (!candidate) return;
    const ballotNumber = value.trim() === "" ? null : Number(value);
    if (ballotNumber !== null && (Number.isNaN(ballotNumber) || ballotNumber < 1)) {
      toast.error("Enter a positive number, or leave empty to clear");
      return;
    }
    try {
      await setBallotNumber({ ballotNumber, candidateId: candidate.id }).unwrap();
      toast.success(ballotNumber === null ? "Ballot number cleared" : "Ballot number set");
      onClose();
    } catch (error) {
      toast.error(getApiErrorMessage(error));
    }
  };

  return (
    <Modal
      description="Unique within the portfolio. Leave empty to clear."
      onClose={onClose}
      open={candidate !== null}
      title={`Ballot number for ${candidate?.name ?? ""}`}
    >
      <div className="space-y-4">
        <Field label="Ballot number">
          <Input
            className="max-w-28"
            min={1}
            onChange={(e) => {
              setValue(e.target.value);
            }}
            placeholder="e.g. 1"
            type="number"
            value={value}
          />
        </Field>
        <div className="flex flex-wrap justify-end gap-2">
          <Button onClick={onClose} type="button" variant="outline">
            Cancel
          </Button>
          <Button loading={isLoading} onClick={save} type="button" variant="brand">
            Save
          </Button>
        </div>
      </div>
    </Modal>
  );
}

export default function ElectionCandidatesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: electionId } = use(params);
  const router = useRouter();
  const [importOpen, setImportOpen] = useState(false);
  const [numbering, setNumbering] = useState<Candidate | null>(null);
  const {
    filters,
    handleFiltersChange,
    handlePageChange,
    handlePageSizeChange,
    page,
    pageSize,
    queryParams,
  } = useTableQueryState<CandidateFilters>({ spec: FILTERS_SPEC });

  const { data, isFetching, isLoading } = useListCandidatesQuery({
    ...queryParams,
    electionId,
  });
  const { data: portfoliosData } = useListPortfoliosQuery({ electionId, limit: 100 });
  const portfolios = portfoliosData?.data ?? [];

  const rows = data?.data ?? [];
  const totalCount = data?.meta.total ?? 0;

  const columns: ColumnDef<Candidate>[] = [
    {
      accessorKey: "name",
      cell: ({ row }) => (
        <div className="flex min-w-0 items-center gap-2.5">
          <EntityAvatar name={row.original.name} url={row.original.profilePicture} />
          <div className="min-w-0 flex-1">
            <Link
              className="block max-w-[90%] truncate text-sm font-medium hover:text-brand"
              href={`/admin/candidates/${row.original.id}`}
              title={row.original.name}
            >
              {row.original.name}
            </Link>
            <p className="max-w-[90%] truncate text-xs text-muted-foreground">
              {row.original.ballotNumber != null
                ? `No. ${String(row.original.ballotNumber)}`
                : ""}
              {row.original.ballotNumber != null && row.original.nickname ? " · " : ""}
              {row.original.nickname ?? ""}
            </p>
          </div>
        </div>
      ),
      header: "Candidate",
      meta: { stretch: true },
    },
    {
      // Portfolio names are admin-authored free text - never a badge.
      cell: ({ row }) => (
        <CellText
          className="max-w-44 text-sm text-muted-foreground"
          text={row.original.portfolio?.name ?? "—"}
        />
      ),
      header: "Portfolio",
      id: "portfolio",
    },
    {
      cell: ({ row }) => <StatusBadge status={row.original.status ?? "QUALIFIED"} />,
      header: "Status",
      id: "status",
    },
    {
      cell: ({ row }) => (
        <span className="text-xs text-muted-foreground">
          {row.original.manifestoUrl
            ? "PDF"
            : row.original.manifesto
              ? "Text"
              : "—"}
        </span>
      ),
      header: "Manifesto",
      id: "manifesto",
    },
    {
      cell: ({ row }) => (
        <RowActionsMenu label="Candidate actions">
          <DropdownMenuItem asChild>
            <Link href={`/admin/candidates/${row.original.id}`}>
              <Eye className="size-4" /> View profile
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href={`/admin/candidates/${row.original.id}?edit=1`}>
              <Pencil className="size-4" /> Edit
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => {
              setNumbering(row.original);
            }}
          >
            <Hash className="size-4" /> Set ballot number
          </DropdownMenuItem>
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
            <div className="flex flex-wrap justify-center gap-2">
              <Button asChild variant="brand">
                <Link href="/admin/candidates/new">
                  <Plus className="size-4" /> Add candidate
                </Link>
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
          description="Nominate candidates to the portfolios on this ballot, one by one or from a spreadsheet."
          icon={UserRound}
          title="No candidates yet"
        />
      }
      entityLabel="candidates"
      filters={filters}
      loading={isLoading || isFetching}
      onClearFilters={() => {
        handleFiltersChange(clearAllFiltersPatch(filters));
      }}
      onPageChange={handlePageChange}
      onPageSizeChange={handlePageSizeChange}
      page={page}
      pageSize={pageSize}
      renderRowCard={(row: Row<Candidate>) => (
        <RowCard
          key={row.id}
          onOpen={() => {
            router.push(`/admin/candidates/${row.original.id}`);
          }}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="flex min-w-0 items-center gap-2">
              <EntityAvatar
                name={row.original.name}
                size="size-7"
                url={row.original.profilePicture}
              />
              <span className="min-w-0 truncate text-sm font-medium">
                {row.original.name}
              </span>
            </span>
            <StatusBadge status={row.original.status ?? "QUALIFIED"} />
          </div>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {row.original.portfolio?.name ?? "—"}
            {row.original.nickname ? ` · ${row.original.nickname}` : ""}
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
              <Button asChild variant="brand">
                <Link href="/admin/candidates/new">
                  <Plus className="size-4" /> Add candidate
                </Link>
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
          searchPlaceholder="Search candidates…"
        >
          <FilterField caption="Portfolio">
            <NativeSelect
              className="w-full lg:w-48"
              onChange={(e) => {
                handleFiltersChange({
                  portfolioId: e.target.value === "all" ? undefined : e.target.value,
                });
              }}
              value={filters.portfolioId ?? "all"}
            >
              <option value="all">All portfolios</option>
              {portfolios.map((portfolio) => (
                <option key={portfolio.id} value={portfolio.id}>
                  {portfolio.name}
                </option>
              ))}
            </NativeSelect>
          </FilterField>
          <FilterField caption="Status">
            <NativeSelect
              className="w-full lg:w-44"
              onChange={(e) => {
                handleFiltersChange({
                  status: e.target.value === "all" ? undefined : e.target.value,
                });
              }}
              value={filters.status ?? "all"}
            >
              <option value="all">All statuses</option>
              {STATUSES.map((status) => (
                <option key={status} value={status}>
                  {CANDIDATE_STATUS_LABELS[status]}
                </option>
              ))}
            </NativeSelect>
          </FilterField>
        </TableToolbar>
      }
      totalCount={totalCount}
    />
    <CandidateImportDialog
      electionId={electionId}
      key={importOpen ? "open" : "closed"}
      onClose={() => {
        setImportOpen(false);
      }}
      open={importOpen}
    />
    <BallotNumberModal
      candidate={numbering}
      key={numbering?.id ?? "closed"}
      onClose={() => {
        setNumbering(null);
      }}
    />
    </>
  );
}
