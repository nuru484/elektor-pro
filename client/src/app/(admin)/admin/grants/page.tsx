"use client";

// Per-user access grants (super-admin only): give one account a capability
// beyond its role - globally or scoped to a single election, with an
// optional expiry. Complements the role matrix on /admin/permissions.
import { type ColumnDef, type Row } from "@tanstack/react-table";
import { KeySquare, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import type { AccessGrant, PermissionsMatrix } from "@/types/api";

import { FilterField, TableToolbar } from "@/components/console/table-toolbar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { DataTable, useDataTable } from "@/components/ui/data-table";
import { Field } from "@/components/ui/field";
import { Input, Select as NativeSelect } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState, PageHeader } from "@/components/ui/states";
import { RowCard } from "@/components/ui/table-bits";
import { clearAllFiltersPatch } from "@/components/ui/table-empty-logic";
import { useAuthRole } from "@/hooks/use-auth-role";
import { type TableFiltersSpec } from "@/hooks/table-query-state-logic";
import { useTableQueryState } from "@/hooks/use-table-query-state";
import { useGetPermissionsQuery, useListElectionsQuery } from "@/redux/admin-api";
import {
  useGrantCapabilityMutation,
  useListGrantsQuery,
  useListStaffUsersQuery,
  useRevokeGrantMutation,
} from "@/redux/governance-api";
import { getApiErrorMessage } from "@/utils/extract-api-error";

const capabilityLabel = (catalog: PermissionsMatrix["catalog"], capability: string) =>
  catalog
    .flatMap((group) => group.capabilities)
    .find((meta) => meta.capability === capability)?.label ?? capability;

interface GrantFilters extends Record<string, string | undefined> {
  capability?: string;
  from?: string;
  to?: string;
}

const FILTERS_SPEC: TableFiltersSpec<GrantFilters> = {
  capability: { kind: "string" },
  from: { kind: "string" },
  to: { kind: "string" },
};

function GrantModal({
  catalog,
  onClose,
  open,
}: {
  catalog: PermissionsMatrix["catalog"];
  onClose: () => void;
  open: boolean;
}) {
  const [grant, { isLoading: granting }] = useGrantCapabilityMutation();
  const { data: staff } = useListStaffUsersQuery({ limit: 100 }, { skip: !open });
  const { data: elections } = useListElectionsQuery({ limit: 100 }, { skip: !open });

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const expires = String(f.get("expiresAt") ?? "");
    try {
      await grant({
        capability: String(f.get("capability")),
        electionId: String(f.get("electionId") ?? "") || undefined,
        expiresAt: expires ? new Date(`${expires}T23:59:59`).toISOString() : undefined,
        userId: String(f.get("userId")),
      }).unwrap();
      toast.success("Capability granted");
      onClose();
    } catch (error) {
      toast.error(getApiErrorMessage(error));
    }
  };

  return (
    <Modal
      description="The grant adds to whatever the user's role already allows. Revoke it anytime."
      onClose={onClose}
      open={open}
      title="Grant capability"
    >
      <form className="space-y-4" onSubmit={onSubmit}>
        <Field label="User">
          <NativeSelect name="userId" required>
            <option value="">Select user…</option>
            {staff?.data
              .filter((user) => user.role !== "SUPER_ADMIN")
              .map((user) => (
                <option key={user.id} value={user.id}>
                  {user.firstName} {user.lastName} ({user.role.toLowerCase()})
                </option>
              ))}
          </NativeSelect>
        </Field>
        <Field label="Capability">
          <NativeSelect name="capability" required>
            <option value="">Select capability…</option>
            {catalog.map((group) => (
              <optgroup key={group.group} label={group.group}>
                {group.capabilities.map((meta) => (
                  <option key={meta.capability} value={meta.capability}>
                    {meta.label}
                  </option>
                ))}
              </optgroup>
            ))}
          </NativeSelect>
        </Field>
        <Field hint="Optional - leave empty for a platform-wide grant." label="Election">
          <NativeSelect name="electionId">
            <option value="">All elections</option>
            {elections?.data.map((election) => (
              <option key={election.id} value={election.id}>
                {election.name}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field hint="Optional - the grant expires at the end of this day." label="Expires">
          <Input className="max-w-44" name="expiresAt" type="date" />
        </Field>
        <Button className="w-full" loading={granting} type="submit" variant="brand">
          Grant capability
        </Button>
      </form>
    </Modal>
  );
}

export default function GrantsPage() {
  const { initialized, isSuperAdmin } = useAuthRole();
  const notAllowed = initialized && !isSuperAdmin;
  const [grantOpen, setGrantOpen] = useState(false);
  const [revoking, setRevoking] = useState<AccessGrant | null>(null);
  const [revoke] = useRevokeGrantMutation();
  const { data: permissions } = useGetPermissionsQuery(undefined, { skip: notAllowed });
  const catalog = permissions?.data.catalog ?? [];

  const {
    filters,
    handleFiltersChange,
    handlePageChange,
    handlePageSizeChange,
    page,
    pageSize,
    queryParams,
  } = useTableQueryState<GrantFilters>({ spec: FILTERS_SPEC });

  const { data, isFetching, isLoading } = useListGrantsQuery(queryParams, {
    skip: notAllowed,
  });
  const rows = data?.data ?? [];
  const totalCount = data?.meta.total ?? 0;

  const columns: ColumnDef<AccessGrant>[] = [
    {
      cell: ({ row }) => (
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">
            {row.original.user.firstName} {row.original.user.lastName}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {row.original.user.email ?? "—"}
          </p>
        </div>
      ),
      header: "User",
      id: "user",
    },
    {
      cell: ({ row }) => (
        <Badge variant="brand">{capabilityLabel(catalog, row.original.capability)}</Badge>
      ),
      header: "Capability",
      id: "capability",
    },
    {
      cell: ({ row }) =>
        row.original.election ? (
          <span className="text-sm">{row.original.election.name}</span>
        ) : (
          <span className="text-xs text-muted-foreground">Platform-wide</span>
        ),
      header: "Scope",
      id: "scope",
    },
    {
      cell: ({ row }) =>
        row.original.expiresAt ? (
          <time className="text-xs whitespace-nowrap tabular-nums text-muted-foreground">
            {new Date(row.original.expiresAt).toLocaleDateString()}
          </time>
        ) : (
          <span className="text-xs text-muted-foreground">Never</span>
        ),
      header: "Expires",
      id: "expires",
    },
    {
      cell: ({ row }) => (
        <div className="flex justify-end">
          <Button
            aria-label="Revoke grant"
            onClick={() => setRevoking(row.original)}
            size="icon-sm"
            variant="ghost"
          >
            <Trash2 className="size-4 text-destructive" />
          </Button>
        </div>
      ),
      header: "",
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

  if (notAllowed) {
    return (
      <EmptyState
        description="Only super administrators can manage access grants."
        icon={KeySquare}
        title="Not available"
      />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        description="Per-user capabilities beyond what roles allow - platform-wide or scoped to one election, with optional expiry."
        title="Access grants"
      />

      <DataTable
        emptyState={
          <EmptyState
            description="Grant an individual account extra capabilities when their role isn't enough."
            icon={KeySquare}
            title="No active grants"
          />
        }
        entityLabel="grants"
        filters={filters}
        loading={isLoading || isFetching}
        onClearFilters={() => handleFiltersChange(clearAllFiltersPatch(filters))}
        onPageChange={handlePageChange}
        onPageSizeChange={handlePageSizeChange}
        page={page}
        pageSize={pageSize}
        renderRowCard={(row: Row<AccessGrant>) => (
          <RowCard
            action={
              <Button
                aria-label="Revoke grant"
                onClick={() => setRevoking(row.original)}
                size="icon-sm"
                variant="ghost"
              >
                <Trash2 className="size-4 text-destructive" />
              </Button>
            }
            key={row.id}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="min-w-0 truncate text-sm font-medium">
                {row.original.user.firstName} {row.original.user.lastName}
              </span>
              <Badge variant="brand">
                {capabilityLabel(catalog, row.original.capability)}
              </Badge>
            </div>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              {row.original.election?.name ?? "Platform-wide"}
              {row.original.expiresAt
                ? ` · until ${new Date(row.original.expiresAt).toLocaleDateString()}`
                : ""}
            </p>
          </RowCard>
        )}
        table={table}
        toolbar={
          <TableToolbar
            actions={
              <Button onClick={() => setGrantOpen(true)} variant="brand">
                <Plus className="size-4" /> Grant capability
              </Button>
            }
            filters={filters}
            onClear={() => handleFiltersChange(clearAllFiltersPatch(filters))}
          >
            <FilterField caption="Capability">
              <Select
                onValueChange={(value) =>
                  handleFiltersChange({ capability: value === "all" ? undefined : value })
                }
                value={filters.capability ?? "all"}
              >
                <SelectTrigger className="w-full lg:w-52">
                  <SelectValue placeholder="All capabilities" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All capabilities</SelectItem>
                  {catalog.flatMap((group) =>
                    group.capabilities.map((meta) => (
                      <SelectItem key={meta.capability} value={meta.capability}>
                        {meta.label}
                      </SelectItem>
                    )),
                  )}
                </SelectContent>
              </Select>
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

      <GrantModal catalog={catalog} onClose={() => setGrantOpen(false)} open={grantOpen} />
      <ConfirmationDialog
        confirmText="Revoke grant"
        description={`${revoking?.user.firstName ?? ""} ${revoking?.user.lastName ?? ""} loses "${capabilityLabel(catalog, revoking?.capability ?? "")}" immediately.`}
        isDestructive
        onConfirm={async () => {
          if (!revoking) return;
          setRevoking(null);
          try {
            await revoke(revoking.id).unwrap();
            toast.success("Grant revoked");
          } catch (error) {
            toast.error(getApiErrorMessage(error));
          }
        }}
        onOpenChange={(open) => !open && setRevoking(null)}
        open={revoking !== null}
        title="Revoke this grant?"
      />
    </div>
  );
}
