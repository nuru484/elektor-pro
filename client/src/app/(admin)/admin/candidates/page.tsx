"use client";

import { type ColumnDef, type Row } from "@tanstack/react-table";
import { ListChecks, Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import type { Candidate } from "@/types/api";

import { TableToolbar } from "@/components/console/table-toolbar";
import { Button } from "@/components/ui/button";
import { DataTable, useDataTable } from "@/components/ui/data-table";
import { Field } from "@/components/ui/field";
import { Input, Select as NativeSelect, Textarea } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Modal } from "@/components/ui/modal";
import { EmptyState, PageHeader } from "@/components/ui/states";
import { RowCard } from "@/components/ui/table-bits";
import { clearAllFiltersPatch } from "@/components/ui/table-empty-logic";
import { type TableFiltersSpec } from "@/hooks/table-query-state-logic";
import { useTableQueryState } from "@/hooks/use-table-query-state";
import {
  useCreateCandidateMutation,
  useGetElectionQuery,
  useListCandidatesQuery,
  useListElectionsQuery,
} from "@/redux/admin-api";
import { getApiErrorMessage } from "@/utils/extract-api-error";

interface CandidateFilters extends Record<string, string | undefined> {
  electionId?: string;
  search?: string;
}

const FILTERS_SPEC: TableFiltersSpec<CandidateFilters> = {
  electionId: { kind: "string" },
  search: { kind: "string" },
};

const COLUMNS: ColumnDef<Candidate>[] = [
  {
    accessorKey: "name",
    cell: ({ row }) => <span className="font-medium">{row.original.name}</span>,
    header: "Candidate",
  },
  {
    cell: ({ row }) => (
      <span className="text-sm text-muted-foreground">
        {row.original.portfolio?.name ?? "—"}
      </span>
    ),
    header: "Portfolio",
    id: "portfolio",
  },
  {
    cell: ({ row }) => (
      <span className="text-sm text-muted-foreground">{row.original.party ?? "—"}</span>
    ),
    header: "Party",
    id: "party",
  },
];

function AddCandidateModal({ onClose, open }: { onClose: () => void; open: boolean }) {
  const [electionId, setElectionId] = useState("");
  const { data: elections } = useListElectionsQuery({ limit: 100 });
  const { data: election } = useGetElectionQuery(electionId, { skip: !electionId });
  const [createCandidate, { isLoading: creating }] = useCreateCandidateMutation();

  const onCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    try {
      const res = await createCandidate({
        electionId: f.get("electionId"),
        manifesto: f.get("manifesto") || undefined,
        name: f.get("name"),
        party: f.get("party") || undefined,
        portfolioId: f.get("portfolioId"),
      }).unwrap();
      onClose();
      toast.success(
        (res as { pending?: boolean }).pending ? "Submitted for approval" : "Candidate added",
      );
    } catch (error) {
      toast.error(getApiErrorMessage(error));
    }
  };

  return (
    <Modal onClose={onClose} open={open} title="Add candidate">
      <form className="space-y-4" onSubmit={onCreate}>
        <Field label="Election">
          <NativeSelect
            name="electionId"
            onChange={(e) => setElectionId(e.target.value)}
            required
            value={electionId}
          >
            <option value="">Select election…</option>
            {elections?.data.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Portfolio">
          <NativeSelect name="portfolioId" required>
            <option value="">Select portfolio…</option>
            {election?.data.portfolios?.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Full name">
          <Input name="name" placeholder="e.g. Kwame Mensah" required />
        </Field>
        <Field label="Party / affiliation">
          <Input name="party" placeholder="e.g. Progressive Alliance (optional)" />
        </Field>
        <Field label="Manifesto">
          <Textarea name="manifesto" placeholder="What the candidate stands for (optional)" />
        </Field>
        <Button className="w-full" loading={creating} type="submit" variant="brand">
          Add candidate
        </Button>
      </form>
    </Modal>
  );
}

export default function CandidatesPage() {
  const [addOpen, setAddOpen] = useState(false);
  const {
    filters,
    handleFiltersChange,
    handlePageChange,
    handlePageSizeChange,
    page,
    pageSize,
    queryParams,
  } = useTableQueryState<CandidateFilters>({ spec: FILTERS_SPEC });

  const { data, isFetching, isLoading } = useListCandidatesQuery(queryParams);
  const { data: elections } = useListElectionsQuery({ limit: 100 });

  const rows = data?.data ?? [];
  const totalCount = data?.meta.total ?? 0;

  const table = useDataTable({
    columns: COLUMNS,
    data: rows,
    enableRowSelection: false,
    getRowId: (row) => row.id,
    pageSize,
    totalCount,
  });

  return (
    <div className="space-y-6">
      <PageHeader
        action={
          <Button onClick={() => setAddOpen(true)} variant="brand">
            <Plus className="size-4" /> Add candidate
          </Button>
        }
        description="Candidates contesting across your elections."
        title="Candidates"
      />

      <DataTable
        emptyState={
          <EmptyState
            action={
              <Button onClick={() => setAddOpen(true)} variant="brand">
                <Plus className="size-4" /> Add candidate
              </Button>
            }
            description="Add candidates once your election and portfolios exist."
            icon={ListChecks}
            title="No candidates yet"
          />
        }
        entityLabel="candidates"
        filters={filters}
        loading={isLoading || isFetching}
        onClearFilters={() => handleFiltersChange(clearAllFiltersPatch(filters))}
        onPageChange={handlePageChange}
        onPageSizeChange={handlePageSizeChange}
        page={page}
        pageSize={pageSize}
        renderRowCard={(row: Row<Candidate>) => (
          <RowCard key={row.id}>
            <div className="flex items-center justify-between gap-2">
              <span className="min-w-0 truncate text-sm font-medium">
                {row.original.name}
              </span>
            </div>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              {row.original.portfolio?.name ?? "No portfolio"}
              {row.original.party ? ` · ${row.original.party}` : ""}
            </p>
          </RowCard>
        )}
        table={table}
        toolbar={
          <TableToolbar
            filters={filters}
            onClear={() => handleFiltersChange(clearAllFiltersPatch(filters))}
            onSearchChange={(value) => handleFiltersChange({ search: value || undefined })}
            search={filters.search ?? ""}
            searchPlaceholder="Search candidates…"
          >
            <Select
              onValueChange={(value) =>
                handleFiltersChange({ electionId: value === "all" ? undefined : value })
              }
              value={filters.electionId ?? "all"}
            >
              <SelectTrigger className="w-full sm:w-52">
                <SelectValue placeholder="All elections" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All elections</SelectItem>
                {elections?.data.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </TableToolbar>
        }
        totalCount={totalCount}
      />

      <AddCandidateModal onClose={() => setAddOpen(false)} open={addOpen} />
    </div>
  );
}
