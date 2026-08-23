"use client";

// The approvals console: the full maker-checker history on the DataTable
// system - filter by status, entity, and date; open a request to inspect its
// payload; approve/reject (with an optional note) or cancel one's own.
import { type ColumnDef, type Row } from "@tanstack/react-table";
import { CheckCircle2, Eye, ShieldCheck, XCircle } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import type { ChangeRequest, ChangeStatus } from "@/types/api";

import { RowActionsMenu } from "@/components/console/row-actions";
import { TableDate } from "@/components/console/table-date";
import { FilterField, TableToolbar } from "@/components/console/table-toolbar";
import { Badge } from "@/components/ui/badge";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { DataTable, useDataTable } from "@/components/ui/data-table";
import { Input, Select as NativeSelect, Textarea } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { EmptyState, PageHeader } from "@/components/ui/states";
import { StatusBadge } from "@/components/ui/status-badge";
import { RowCard } from "@/components/ui/table-bits";
import { clearAllFiltersPatch } from "@/components/ui/table-empty-logic";
import { useAuthRole } from "@/hooks/use-auth-role";
import { type TableFiltersSpec } from "@/hooks/table-query-state-logic";
import { useTableQueryState } from "@/hooks/use-table-query-state";
import {
  useApproveChangeMutation,
  useCancelChangeMutation,
  useGetChangeRequestQuery,
  useListChangeRequestsQuery,
  useRejectChangeMutation,
} from "@/redux/admin-api";
import { getApiErrorMessage } from "@/utils/extract-api-error";
import { formatDateTime } from "@/utils/format-date";

const STATUSES: ChangeStatus[] = [
  "PENDING",
  "APPLIED",
  "REJECTED",
  "CANCELLED",
  "FAILED",
];

const ENTITIES = [
  "ELECTION",
  "PORTFOLIO",
  "CANDIDATE",
  "VOTER",
  "GROUP",
  "GROUP_CATEGORY",
  "ORGANIZATION",
] as const;

interface ApprovalFilters extends Record<string, string | undefined> {
  entity?: string;
  from?: string;
  search?: string;
  status?: string;
  to?: string;
}

const FILTERS_SPEC: TableFiltersSpec<ApprovalFilters> = {
  entity: { kind: "enum", values: ENTITIES },
  from: { kind: "string" },
  search: { kind: "string" },
  status: { kind: "enum", values: STATUSES },
  to: { kind: "string" },
};

const titleOf = (cr: ChangeRequest): string =>
  cr.summary ?? `${cr.action.toLowerCase()} ${cr.entity.replace("_", " ").toLowerCase()}`;

/** Detail + review actions for one change request. */
function ChangeRequestModal({
  id,
  onClose,
}: {
  id: null | string;
  onClose: () => void;
}) {
  const { can, user } = useAuthRole();
  const { data } = useGetChangeRequestQuery(id ?? "", { skip: !id });
  const [note, setNote] = useState("");
  const [confirm, setConfirm] = useState<"approve" | "cancel" | "reject" | null>(null);
  const [approve, { isLoading: approving }] = useApproveChangeMutation();
  const [reject, { isLoading: rejecting }] = useRejectChangeMutation();
  const [cancel, { isLoading: cancelling }] = useCancelChangeMutation();

  const cr = data?.data;
  const pending = cr?.status === "PENDING";
  const canReview = can("APPROVE_CHANGES");
  const isMine = Boolean(cr && user && cr.requestedById === user.id);

  const run = async (action: "approve" | "cancel" | "reject") => {
    if (!cr) return;
    setConfirm(null);
    try {
      if (action === "approve") {
        await approve({ id: cr.id, note: note || undefined }).unwrap();
        toast.success("Change approved and applied");
      } else if (action === "reject") {
        await reject({ id: cr.id, note: note || undefined }).unwrap();
        toast.success("Change rejected");
      } else {
        await cancel({ id: cr.id }).unwrap();
        toast.success("Change request cancelled");
      }
      onClose();
    } catch (error) {
      toast.error(getApiErrorMessage(error));
    }
  };

  return (
    <Modal onClose={onClose} open={Boolean(id)} title="Change request">
      {cr ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">{cr.action.toLowerCase()}</Badge>
            <Badge variant="brand">{cr.entity.replace("_", " ").toLowerCase()}</Badge>
            <StatusBadge status={cr.status} />
          </div>

          {/* Summaries/notes carry user-authored text with possibly unbroken
              tokens - everything wraps, nothing stretches the dialog. */}
          <div className="min-w-0 space-y-1 text-sm">
            <p className="min-w-0 font-medium [overflow-wrap:anywhere]">{titleOf(cr)}</p>
            <p className="text-xs text-muted-foreground [overflow-wrap:anywhere]">
              Requested{" "}
              {cr.requestedBy
                ? `by ${cr.requestedBy.firstName} ${cr.requestedBy.lastName}`
                : ""}{" "}
              on {formatDateTime(cr.createdAt)}
            </p>
            {cr.reviewedBy && (
              <p className="text-xs text-muted-foreground [overflow-wrap:anywhere]">
                Reviewed by {cr.reviewedBy.firstName} {cr.reviewedBy.lastName}
                {cr.reviewedAt ? ` on ${formatDateTime(cr.reviewedAt)}` : ""}
                {cr.reviewNote ? ` - "${cr.reviewNote}"` : ""}
              </p>
            )}
            {cr.error && (
              <p className="text-xs text-destructive [overflow-wrap:anywhere]">
                Failed: {cr.error}
              </p>
            )}
          </div>

          {cr.payload && (
            <div className="min-w-0">
              <p className="mb-1 text-[11px] font-medium tracking-[0.08em] text-muted-foreground uppercase">
                Requested changes
              </p>
              {/* pre-wrap + anywhere: long JSON strings wrap into view instead
                  of forcing a horizontal scroll inside the dialog. */}
              <pre className="max-h-56 overflow-y-auto rounded-lg border border-border bg-muted/30 p-3 font-mono text-xs whitespace-pre-wrap [overflow-wrap:anywhere]">
                {JSON.stringify(cr.payload, null, 2)}
              </pre>
            </div>
          )}

          {pending && canReview && (
            <Textarea
              onChange={(e) => setNote(e.target.value)}
              placeholder="Review note (optional)"
              value={note}
            />
          )}

          {pending && (
            <div className="flex flex-wrap justify-end gap-2">
              {isMine && (
                <Button
                  loading={cancelling}
                  onClick={() => setConfirm("cancel")}
                  size="sm"
                  variant="outline"
                >
                  Cancel request
                </Button>
              )}
              {canReview && (
                <>
                  <Button
                    loading={rejecting}
                    onClick={() => setConfirm("reject")}
                    size="sm"
                    variant="outline"
                  >
                    <XCircle className="size-4" /> Reject
                  </Button>
                  <Button
                    loading={approving}
                    onClick={() => setConfirm("approve")}
                    size="sm"
                    variant="brand"
                  >
                    <CheckCircle2 className="size-4" /> Approve
                  </Button>
                </>
              )}
            </div>
          )}
        </div>
      ) : (
        <p className="py-6 text-center text-sm text-muted-foreground">Loading…</p>
      )}

      <ConfirmationDialog
        confirmText={
          confirm === "approve"
            ? "Approve and apply"
            : confirm === "reject"
              ? "Reject change"
              : "Cancel request"
        }
        description={
          confirm === "approve"
            ? "The requested change will be applied immediately and recorded in the audit trail."
            : confirm === "reject"
              ? "The request will be closed with no effect."
              : "Your pending request will be withdrawn."
        }
        isDestructive={confirm !== "approve"}
        onConfirm={() => confirm && run(confirm)}
        onOpenChange={(open) => !open && setConfirm(null)}
        open={confirm !== null}
        title={
          confirm === "approve"
            ? "Approve this change?"
            : confirm === "reject"
              ? "Reject this change?"
              : "Cancel this request?"
        }
      />
    </Modal>
  );
}

export default function ApprovalsPage() {
  const [selectedId, setSelectedId] = useState<null | string>(null);
  const {
    filters,
    handleFiltersChange,
    handlePageChange,
    handlePageSizeChange,
    page,
    pageSize,
    queryParams,
  } = useTableQueryState<ApprovalFilters>({ spec: FILTERS_SPEC });

  const { data, isFetching, isLoading } = useListChangeRequestsQuery(queryParams);

  const rows = data?.data ?? [];
  const totalCount = data?.meta.total ?? 0;

  const columns: ColumnDef<ChangeRequest>[] = [
    {
      accessorKey: "createdAt",
      cell: ({ row }) => (
<TableDate value={row.original.createdAt} />
      ),
      header: "Requested",
    },
    {
      cell: ({ row }) => (
        <div className="min-w-0">
          <p
            className="max-w-[90%] truncate text-sm font-medium"
            title={titleOf(row.original)}
          >
            {titleOf(row.original)}
          </p>
          <p className="text-xs text-muted-foreground">
            {row.original.action.toLowerCase()} ·{" "}
            {row.original.entity.replace("_", " ").toLowerCase()}
          </p>
        </div>
      ),
      meta: { stretch: true },
      header: "Change",
      id: "change",
    },
    {
      cell: ({ row }) =>
        row.original.requestedBy ? (
          <span className="text-sm">
            {row.original.requestedBy.firstName} {row.original.requestedBy.lastName}
          </span>
        ) : (
          <span className="text-sm text-muted-foreground">—</span>
        ),
      header: "By",
      id: "by",
    },
    {
      accessorKey: "status",
      cell: ({ row }) => <StatusBadge status={row.original.status} />,
      header: "Status",
    },
    {
      cell: ({ row }) => (
        <RowActionsMenu label="Request actions">
          <DropdownMenuItem onClick={() => setSelectedId(row.original.id)}>
            <Eye className="size-4" /> View details
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
    <div className="space-y-6">
      <PageHeader
        description="Every change proposed through maker-checker: review pending requests, or trace how past ones were resolved."
        title="Approvals"
      />

      <DataTable
        emptyState={
          <EmptyState
            description="Changes staged by admins will appear here for review."
            icon={ShieldCheck}
            title="Nothing to approve"
          />
        }
        entityLabel="change requests"
        filters={filters}
        loading={isLoading || isFetching}
        onClearFilters={() => handleFiltersChange(clearAllFiltersPatch(filters))}
        onPageChange={handlePageChange}
        onPageSizeChange={handlePageSizeChange}
        page={page}
        pageSize={pageSize}
        renderRowCard={(row: Row<ChangeRequest>) => (
          <RowCard key={row.id} onOpen={() => setSelectedId(row.original.id)}>
            <div className="flex items-center justify-between gap-2">
              <span className="min-w-0 truncate text-sm font-medium">
                {titleOf(row.original)}
              </span>
              <StatusBadge status={row.original.status} />
            </div>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              {row.original.requestedBy
                ? `${row.original.requestedBy.firstName} ${row.original.requestedBy.lastName} · `
                : ""}
              {formatDateTime(row.original.createdAt)}
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
            searchPlaceholder="Search change requests…"
          >
            <FilterField caption="Status">
              <NativeSelect
                className="w-full lg:w-40"
                onChange={(e) =>
                  handleFiltersChange({
                    status: e.target.value === "all" ? undefined : e.target.value,
                  })
                }
                value={filters.status ?? "all"}
              >
                <option value="all">All statuses</option>
                {STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {status.charAt(0) + status.slice(1).toLowerCase()}
                  </option>
                ))}
              </NativeSelect>
            </FilterField>
            <FilterField caption="Entity">
              <NativeSelect
                className="w-full lg:w-44"
                onChange={(e) =>
                  handleFiltersChange({
                    entity: e.target.value === "all" ? undefined : e.target.value,
                  })
                }
                value={filters.entity ?? "all"}
              >
                <option value="all">All entities</option>
                {ENTITIES.map((entity) => (
                  <option key={entity} value={entity}>
                    {entity.replace("_", " ").toLowerCase()}
                  </option>
                ))}
              </NativeSelect>
            </FilterField>
            <FilterField caption="From date">
              <Input
                aria-label="From date"
                className="w-full lg:w-38"
                onChange={(e) => handleFiltersChange({ from: e.target.value || undefined })}
                type="date"
                value={filters.from ?? ""}
              />
            </FilterField>
            <FilterField caption="To date">
              <Input
                aria-label="To date"
                className="w-full lg:w-38"
                onChange={(e) => handleFiltersChange({ to: e.target.value || undefined })}
                type="date"
                value={filters.to ?? ""}
              />
            </FilterField>
          </TableToolbar>
        }
        totalCount={totalCount}
      />

      <ChangeRequestModal id={selectedId} onClose={() => setSelectedId(null)} />
    </div>
  );
}
