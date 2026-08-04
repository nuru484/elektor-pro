"use client";

import { type ColumnDef, type Row } from "@tanstack/react-table";
import { Eye, ListChecks, Plus } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";

import type { Candidate } from "@/types/api";

import { PhotoInput } from "@/components/console/photo-input";
import { RowActionsMenu } from "@/components/console/row-actions";
import { FilterField, TableToolbar } from "@/components/console/table-toolbar";
import { Button } from "@/components/ui/button";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { DataTable, useDataTable } from "@/components/ui/data-table";
import { Field } from "@/components/ui/field";
import { Input, Select as NativeSelect, Textarea } from "@/components/ui/input";
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
  {
    cell: ({ row }) => (
      <RowActionsMenu label="Candidate actions">
        <DropdownMenuItem asChild>
          <Link href={`/admin/candidates/${row.original.id}`}>
            <Eye className="size-4" /> View profile
          </Link>
        </DropdownMenuItem>
      </RowActionsMenu>
    ),
    header: "Actions",
    id: "actions",
  },
];

function AddCandidateModal({ onClose, open }: { onClose: () => void; open: boolean }) {
  const [electionId, setElectionId] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const { data: elections } = useListElectionsQuery({ limit: 100 });
  const { data: election } = useGetElectionQuery(electionId, { skip: !electionId });
  const [createCandidate, { isLoading: creating }] = useCreateCandidateMutation();

  const onCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const body = new FormData();
    body.append("electionId", String(f.get("electionId")));
    body.append("portfolioId", String(f.get("portfolioId")));
    body.append("name", String(f.get("name")));
    if (f.get("party")) body.append("party", String(f.get("party")));
    if (f.get("manifesto")) body.append("manifesto", String(f.get("manifesto")));
    if (photo) body.append("image", photo);
    try {
      const res = await createCandidate(body).unwrap();
      setPhoto(null);
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
        <PhotoInput file={photo} onChange={setPhoto} />
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
            actions={
              <Button onClick={() => setAddOpen(true)} variant="brand">
                <Plus className="size-4" /> Add candidate
              </Button>
            }
            filters={filters}
            onClear={() => handleFiltersChange(clearAllFiltersPatch(filters))}
            onSearchChange={(value) => handleFiltersChange({ search: value || undefined })}
            search={filters.search ?? ""}
            searchPlaceholder="Search candidates…"
          >
            <FilterField caption="Election">
              <NativeSelect
                className="w-full lg:w-52"
                onChange={(e) =>
                  handleFiltersChange({
                    electionId: e.target.value === "all" ? undefined : e.target.value,
                  })
                }
                value={filters.electionId ?? "all"}
              >
                <option value="all">All elections</option>
                {elections?.data.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name}
                  </option>
                ))}
              </NativeSelect>
            </FilterField>
          </TableToolbar>
        }
        totalCount={totalCount}
      />

      <AddCandidateModal onClose={() => setAddOpen(false)} open={addOpen} />
    </div>
  );
}
