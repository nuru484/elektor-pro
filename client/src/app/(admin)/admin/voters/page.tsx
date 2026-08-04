"use client";

import { type ColumnDef, type Row } from "@tanstack/react-table";
import { Plus, Users } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import type { Voter } from "@/types/api";

import { TableToolbar } from "@/components/console/table-toolbar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable, useDataTable } from "@/components/ui/data-table";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { EmptyState, PageHeader } from "@/components/ui/states";
import { RowCard } from "@/components/ui/table-bits";
import { clearAllFiltersPatch } from "@/components/ui/table-empty-logic";
import { type TableFiltersSpec } from "@/hooks/table-query-state-logic";
import { useTableQueryState } from "@/hooks/use-table-query-state";
import { useCreateVoterMutation, useListVotersQuery } from "@/redux/admin-api";
import { getApiErrorMessage } from "@/utils/extract-api-error";

interface VoterFilters extends Record<string, string | undefined> {
  search?: string;
}

const FILTERS_SPEC: TableFiltersSpec<VoterFilters> = {
  search: { kind: "string" },
};

const COLUMNS: ColumnDef<Voter>[] = [
  {
    accessorKey: "name",
    cell: ({ row }) => <span className="font-medium">{row.original.name}</span>,
    header: "Name",
  },
  {
    accessorKey: "voterId",
    cell: ({ row }) => (
      <span className="font-mono text-xs">{row.original.voterId}</span>
    ),
    header: "Voter ID",
  },
  {
    cell: ({ row }) => (
      <span className="text-sm text-muted-foreground">
        {row.original.phoneNumber ?? "—"}
      </span>
    ),
    header: "Phone",
    id: "phone",
  },
  {
    cell: ({ row }) => (
      <div className="flex flex-wrap gap-1">
        {row.original.groupMemberships?.slice(0, 3).map((membership) => (
          <Badge key={membership.group.id} variant="outline">
            {membership.group.name}
          </Badge>
        ))}
      </div>
    ),
    header: "Groups",
    id: "groups",
  },
];

function AddVoterModal({ onClose, open }: { onClose: () => void; open: boolean }) {
  const [createVoter, { isLoading: creating }] = useCreateVoterMutation();

  const onCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    try {
      const res = await createVoter({
        name: f.get("name"),
        phoneNumber: f.get("phoneNumber") || undefined,
        voterId: f.get("voterId"),
      }).unwrap();
      onClose();
      toast.success(
        (res as { pending?: boolean }).pending ? "Submitted for approval" : "Voter added",
      );
    } catch (error) {
      toast.error(getApiErrorMessage(error));
    }
  };

  return (
    <Modal onClose={onClose} open={open} title="Add voter">
      <form className="space-y-4" onSubmit={onCreate}>
        <Field label="Full name">
          <Input name="name" placeholder="e.g. Ama Owusu" required />
        </Field>
        <Field hint="Index / membership number" label="Voter ID">
          <Input name="voterId" placeholder="e.g. STU1234" required />
        </Field>
        <Field hint="Used to send their one-time login code" label="Phone number">
          <Input name="phoneNumber" placeholder="e.g. +233 24 000 0000" />
        </Field>
        <Button className="w-full" loading={creating} type="submit" variant="brand">
          Add voter
        </Button>
      </form>
    </Modal>
  );
}

export default function VotersPage() {
  const [addOpen, setAddOpen] = useState(false);
  const {
    filters,
    handleFiltersChange,
    handlePageChange,
    handlePageSizeChange,
    page,
    pageSize,
    queryParams,
  } = useTableQueryState<VoterFilters>({ spec: FILTERS_SPEC });

  const { data, isFetching, isLoading } = useListVotersQuery(queryParams);

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
            <Plus className="size-4" /> Add voter
          </Button>
        }
        description="The people eligible to vote in your elections."
        title="Voters"
      />

      <DataTable
        emptyState={
          <EmptyState
            action={
              <Button onClick={() => setAddOpen(true)} variant="brand">
                <Plus className="size-4" /> Add voter
              </Button>
            }
            description="Add voters individually or import them in bulk."
            icon={Users}
            title="No voters yet"
          />
        }
        entityLabel="voters"
        filters={filters}
        loading={isLoading || isFetching}
        onClearFilters={() => handleFiltersChange(clearAllFiltersPatch(filters))}
        onPageChange={handlePageChange}
        onPageSizeChange={handlePageSizeChange}
        page={page}
        pageSize={pageSize}
        renderRowCard={(row: Row<Voter>) => (
          <RowCard key={row.id}>
            <div className="flex items-center justify-between gap-2">
              <span className="min-w-0 truncate text-sm font-medium">
                {row.original.name}
              </span>
              <span className="shrink-0 font-mono text-[11px] text-muted-foreground">
                {row.original.voterId}
              </span>
            </div>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              {row.original.phoneNumber ?? "No phone"}
              {row.original.groupMemberships?.length
                ? ` · ${row.original.groupMemberships.map((m) => m.group.name).join(", ")}`
                : ""}
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
            searchPlaceholder="Search by name, ID, or phone…"
          />
        }
        totalCount={totalCount}
      />

      <AddVoterModal onClose={() => setAddOpen(false)} open={addOpen} />
    </div>
  );
}
