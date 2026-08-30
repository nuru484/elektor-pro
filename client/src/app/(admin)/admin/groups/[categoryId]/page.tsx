"use client";

// Category workspace: one categorization dimension (e.g. Department) with the
// groups inside it, its membership rule, and per-group counts - the drill-down
// from the Categories tab.
import { type ColumnDef, type Row } from "@tanstack/react-table";
import { Eye, FolderTree, Pencil, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { use, useState } from "react";
import { toast } from "sonner";

import type { Group } from "@/types/api";

import { RowActionsMenu } from "@/components/console/row-actions";
import { TableToolbar } from "@/components/console/table-toolbar";
import { BackButton } from "@/components/ui/back-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { DataTable, useDataTable } from "@/components/ui/data-table";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { Field } from "@/components/ui/field";
import { Input, Textarea } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { CellText, RowCard } from "@/components/ui/table-bits";
import { useAuthRole } from "@/hooks/use-auth-role";
import { type TableFiltersSpec } from "@/hooks/table-query-state-logic";
import { useTableQueryState } from "@/hooks/use-table-query-state";
import {
  useCreateGroupMutation,
  useDeleteGroupMutation,
  useGetGroupCategoryQuery,
  useListGroupsQuery,
  useUpdateGroupMutation,
} from "@/redux/governance-api";
import { getApiErrorMessage } from "@/utils/extract-api-error";
import { type FormErrors, validateRequired } from "@/utils/form-validate";

const pendingToast = (res: unknown, applied: string) => {
  toast.success(
    (res as { pending?: boolean }).pending ? "Submitted for approval" : applied,
  );
};

/** Create/edit a group inside this category (category is fixed). */
function CategoryGroupModal({
  categoryId,
  group,
  onClose,
  open,
}: {
  categoryId: string;
  group: Group | null;
  onClose: () => void;
  open: boolean;
}) {
  const [create, { isLoading: creating }] = useCreateGroupMutation();
  const [update, { isLoading: updating }] = useUpdateGroupMutation();
  const [errors, setErrors] = useState<FormErrors>({});

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const errs = validateRequired(f, { code: "Code", name: "Name" });
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;
    const body = {
      categoryId,
      code: f.get("code"),
      description: f.get("description") || undefined,
      name: f.get("name"),
    };
    try {
      const res = group
        ? await update({ data: body, id: group.id }).unwrap()
        : await create(body).unwrap();
      pendingToast(res, group ? "Group updated" : "Group created");
      onClose();
    } catch (error) {
      toast.error(getApiErrorMessage(error));
    }
  };

  return (
    <Modal onClose={onClose} open={open} title={group ? "Edit group" : "New group"}>
      <form className="space-y-4" noValidate onSubmit={onSubmit}>
        <Field error={errors.name} label="Name">
          <Input
            defaultValue={group?.name ?? ""}
            name="name"
            placeholder="e.g. Computer Science"
            required
          />
        </Field>
        <Field error={errors.code} hint="Short unique identifier used in imports." label="Code">
          <Input
            className="max-w-40 font-mono"
            defaultValue={group?.code ?? ""}
            name="code"
            placeholder="e.g. CS"
            required
          />
        </Field>
        <Field label="Description">
          <Textarea
            defaultValue={group?.description ?? ""}
            name="description"
            placeholder="Who belongs in this group (optional)"
          />
        </Field>
        <Button className="w-full" loading={creating || updating} type="submit" variant="brand">
          {group ? "Save changes" : "Create group"}
        </Button>
      </form>
    </Modal>
  );
}

interface GroupFilters extends Record<string, string | undefined> {
  search?: string;
}

const FILTERS_SPEC: TableFiltersSpec<GroupFilters> = {
  search: { kind: "string" },
};

export default function CategoryDetailPage({
  params,
}: {
  params: Promise<{ categoryId: string }>;
}) {
  const { categoryId } = use(params);
  const router = useRouter();
  const { isSuperAdmin } = useAuthRole();
  const {
    data: categoryData,
    error: categoryError,
    isError: categoryIsError,
    isLoading: categoryLoading,
  } = useGetGroupCategoryQuery(categoryId);
  const category = categoryData?.data;

  const [modal, setModal] = useState<{ group: Group | null; open: boolean }>({
    group: null,
    open: false,
  });
  const [deleting, setDeleting] = useState<Group | null>(null);
  const [deleteGroup] = useDeleteGroupMutation();

  const {
    filters,
    handleFiltersChange,
    handlePageChange,
    handlePageSizeChange,
    page,
    pageSize,
    queryParams,
  } = useTableQueryState<GroupFilters>({ spec: FILTERS_SPEC });

  const { data, isFetching, isLoading } = useListGroupsQuery({
    ...queryParams,
    categoryId,
  });
  const rows = data?.data ?? [];
  const totalCount = data?.meta.total ?? 0;

  const columns: ColumnDef<Group>[] = [
    {
      accessorKey: "name",
      cell: ({ row }) => (
        <div className="min-w-0">
          <Link
            className="block max-w-[90%] truncate text-sm font-medium hover:text-brand"
            href={`/admin/groups/${categoryId}/${row.original.id}`}
            title={row.original.name}
          >
            {row.original.name}
          </Link>
          <p className="font-mono text-xs text-muted-foreground">{row.original.code}</p>
        </div>
      ),
      header: "Group",
      meta: { stretch: true },
    },
    {
      cell: ({ row }) => (
        <span className="text-sm tabular-nums text-muted-foreground">
          {row.original._count?.voterMemberships ?? 0}
        </span>
      ),
      header: "Voters",
      id: "voters",
    },
    {
      cell: ({ row }) => (
        <CellText
          className="max-w-64 text-xs text-muted-foreground"
          text={row.original.description ?? "—"}
        />
      ),
      header: "Description",
      id: "description",
    },
    {
      cell: ({ row }) => (
        <RowActionsMenu label="Group actions">
          <DropdownMenuItem asChild>
            <Link href={`/admin/groups/${categoryId}/${row.original.id}`}>
              <Eye className="size-4" /> View details
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => {
              setModal({ group: row.original, open: true });
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

  if (categoryIsError) {
    return <ErrorState message={getApiErrorMessage(categoryError, "Could not load this category")} />;
  }

  return (
    <div className="space-y-5">
      {categoryLoading || !category ? (
        <div className="space-y-2">
          <Skeleton className="h-7 w-56" />
          <Skeleton className="h-4 w-72" />
        </div>
      ) : (
        <div className="flex min-w-0 items-start gap-1.5">
          {/* The negative top margin centres the 40px target on the name's
              line box rather than on the whole heading block. */}
          <BackButton
            className="-mt-1.5 sm:-mt-1"
            href="/admin/groups"
            label="Back to groups"
          />
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="min-w-0 text-xl font-semibold [overflow-wrap:anywhere] sm:text-2xl">
                {category.name}
              </h1>
              <Badge variant="outline">
                {category.allowMultiple ? "Multiple memberships" : "Single membership"}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              <span className="font-mono text-xs">{category.code}</span>
              {" · "}
              {category._count?.groups ?? totalCount} groups
              {category.allowMultiple
                ? " · voters may join several groups here"
                : " · voters join exactly one group here"}
            </p>
            {category.description && (
              <p className="min-w-0 text-sm text-muted-foreground [overflow-wrap:anywhere]">
                {category.description}
              </p>
            )}
          </div>
        </div>
      )}

      <DataTable
        emptyState={
          <EmptyState
            action={
              <Button
                onClick={() => {
                  setModal({ group: null, open: true });
                }}
                variant="brand"
              >
                <Plus className="size-4" /> New group
              </Button>
            }
            description="Add the groups voters join under this category."
            icon={FolderTree}
            title="No groups in this category yet"
          />
        }
        entityLabel="groups"
        filters={filters}
        loading={isLoading || isFetching}
        onClearFilters={() => {
          handleFiltersChange({ search: undefined });
        }}
        onPageChange={handlePageChange}
        onPageSizeChange={handlePageSizeChange}
        page={page}
        pageSize={pageSize}
        renderRowCard={(row: Row<Group>) => (
          <RowCard
            key={row.id}
            onOpen={() => {
              router.push(`/admin/groups/${categoryId}/${row.original.id}`);
            }}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="min-w-0 truncate text-sm font-medium">
                {row.original.name}
              </span>
              <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
                {row.original._count?.voterMemberships ?? 0} voters
              </span>
            </div>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              {row.original.code}
            </p>
          </RowCard>
        )}
        table={table}
        toolbar={
          <TableToolbar
            actions={
              <Button
                onClick={() => {
                  setModal({ group: null, open: true });
                }}
                variant="brand"
              >
                <Plus className="size-4" /> New group
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
            searchPlaceholder="Search groups…"
          />
        }
        totalCount={totalCount}
      />

      <CategoryGroupModal
        categoryId={categoryId}
        group={modal.group}
        key={modal.group?.id ?? (modal.open ? "new" : "closed")}
        onClose={() => {
          setModal({ group: null, open: false });
        }}
        open={modal.open}
      />
      <ConfirmationDialog
        confirmText="Delete group"
        description={`"${deleting?.name ?? ""}" will be removed. Voters keep their other memberships.`}
        isDestructive
        onConfirm={async () => {
          if (!deleting) return;
          setDeleting(null);
          try {
            const res = await deleteGroup(deleting.id).unwrap();
            pendingToast(res, "Group deleted");
          } catch (error) {
            toast.error(getApiErrorMessage(error));
          }
        }}
        onOpenChange={(open) => {
          if (!open) setDeleting(null);
        }}
        open={deleting !== null}
        title="Delete this group?"
      />
    </div>
  );
}
