"use client";

// Groups & categories: the constituency system. Categories (e.g. "College")
// hold groups (e.g. "Science"); voters join groups, and elections/portfolios
// scope eligibility by them. Two tabs, each on the DataTable system; all
// mutations ride maker-checker (202 = staged for approval).
import { type ColumnDef, type Row } from "@tanstack/react-table";
import { FolderTree, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import type { Group, GroupCategory } from "@/types/api";

import { FilterField, TableToolbar } from "@/components/console/table-toolbar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { DataTable, useDataTable } from "@/components/ui/data-table";
import { Field } from "@/components/ui/field";
import { Input, Select as NativeSelect, Textarea } from "@/components/ui/input";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuthRole } from "@/hooks/use-auth-role";
import { type TableFiltersSpec } from "@/hooks/table-query-state-logic";
import { useTableQueryState } from "@/hooks/use-table-query-state";
import {
  useCreateGroupCategoryMutation,
  useCreateGroupMutation,
  useDeleteGroupCategoryMutation,
  useDeleteGroupMutation,
  useListGroupCategoriesQuery,
  useListGroupsQuery,
  useUpdateGroupCategoryMutation,
  useUpdateGroupMutation,
} from "@/redux/governance-api";
import { getApiErrorMessage } from "@/utils/extract-api-error";

const pendingToast = (res: unknown, applied: string) => {
  toast.success(
    (res as { pending?: boolean }).pending ? "Submitted for approval" : applied,
  );
};

// --- Category modal (create / edit) ---

function CategoryModal({
  category,
  onClose,
  open,
}: {
  category: GroupCategory | null;
  onClose: () => void;
  open: boolean;
}) {
  const [create, { isLoading: creating }] = useCreateGroupCategoryMutation();
  const [update, { isLoading: updating }] = useUpdateGroupCategoryMutation();

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const body = {
      allowMultiple: f.get("allowMultiple") === "on",
      code: f.get("code"),
      description: f.get("description") || undefined,
      name: f.get("name"),
    };
    try {
      const res = category
        ? await update({ data: body, id: category.id }).unwrap()
        : await create(body).unwrap();
      pendingToast(res, category ? "Category updated" : "Category created");
      onClose();
    } catch (error) {
      toast.error(getApiErrorMessage(error));
    }
  };

  return (
    <Modal
      onClose={onClose}
      open={open}
      title={category ? "Edit category" : "New category"}
    >
      <form className="space-y-4" onSubmit={onSubmit}>
        <Field label="Name">
          <Input
            defaultValue={category?.name ?? ""}
            name="name"
            placeholder="e.g. College"
            required
          />
        </Field>
        <Field hint="Short unique identifier used in imports." label="Code">
          <Input
            className="max-w-40 font-mono"
            defaultValue={category?.code ?? ""}
            name="code"
            placeholder="e.g. COL"
            required
          />
        </Field>
        <Field label="Description">
          <Textarea
            defaultValue={category?.description ?? ""}
            name="description"
            placeholder="What this category groups voters by (optional)"
          />
        </Field>
        <label className="flex items-center gap-2 text-sm">
          <input
            className="size-4 accent-brand"
            defaultChecked={category?.allowMultiple ?? false}
            name="allowMultiple"
            type="checkbox"
          />
          Voters may belong to several groups in this category
        </label>
        <Button className="w-full" loading={creating || updating} type="submit" variant="brand">
          {category ? "Save changes" : "Create category"}
        </Button>
      </form>
    </Modal>
  );
}

// --- Group modal (create / edit) ---

function GroupModal({
  categories,
  group,
  onClose,
  open,
}: {
  categories: GroupCategory[];
  group: Group | null;
  onClose: () => void;
  open: boolean;
}) {
  const [create, { isLoading: creating }] = useCreateGroupMutation();
  const [update, { isLoading: updating }] = useUpdateGroupMutation();

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const body = {
      categoryId: f.get("categoryId"),
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
      <form className="space-y-4" onSubmit={onSubmit}>
        <Field label="Category">
          <NativeSelect
            defaultValue={group?.categoryId ?? ""}
            name="categoryId"
            required
          >
            <option value="">Select category…</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Name">
          <Input
            defaultValue={group?.name ?? ""}
            name="name"
            placeholder="e.g. Science"
            required
          />
        </Field>
        <Field hint="Short unique identifier used in imports." label="Code">
          <Input
            className="max-w-40 font-mono"
            defaultValue={group?.code ?? ""}
            name="code"
            placeholder="e.g. SCI"
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

// --- Groups tab ---

interface GroupFilters extends Record<string, string | undefined> {
  categoryId?: string;
  search?: string;
}

const GROUP_FILTERS_SPEC: TableFiltersSpec<GroupFilters> = {
  categoryId: { kind: "string" },
  search: { kind: "string" },
};

function GroupsTab({ categories }: { categories: GroupCategory[] }) {
  const { isSuperAdmin } = useAuthRole();
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
  } = useTableQueryState<GroupFilters>({ prefix: "groups", spec: GROUP_FILTERS_SPEC });

  const { data, isFetching, isLoading } = useListGroupsQuery(queryParams);
  const rows = data?.data ?? [];
  const totalCount = data?.meta.total ?? 0;

  const columns: ColumnDef<Group>[] = [
    {
      accessorKey: "name",
      cell: ({ row }) => (
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{row.original.name}</p>
          <p className="font-mono text-xs text-muted-foreground">{row.original.code}</p>
        </div>
      ),
      header: "Group",
    },
    {
      cell: ({ row }) => (
        <Badge variant="outline">{row.original.category?.name ?? "—"}</Badge>
      ),
      header: "Category",
      id: "category",
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
        <div className="flex justify-end gap-1">
          <Button
            onClick={() => setModal({ group: row.original, open: true })}
            size="sm"
            variant="ghost"
          >
            Edit
          </Button>
          {isSuperAdmin && (
            <Button
              aria-label="Delete group"
              onClick={() => setDeleting(row.original)}
              size="icon-sm"
              variant="ghost"
            >
              <Trash2 className="size-4 text-destructive" />
            </Button>
          )}
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

  return (
    <>
      <DataTable
        emptyState={
          <EmptyState
            action={
              <Button
                onClick={() => setModal({ group: null, open: true })}
                variant="brand"
              >
                <Plus className="size-4" /> New group
              </Button>
            }
            description="Create groups once a category exists - voters join groups to become eligible for scoped elections."
            icon={FolderTree}
            title="No groups yet"
          />
        }
        entityLabel="groups"
        filters={filters}
        loading={isLoading || isFetching}
        onClearFilters={() => handleFiltersChange(clearAllFiltersPatch(filters))}
        onPageChange={handlePageChange}
        onPageSizeChange={handlePageSizeChange}
        page={page}
        pageSize={pageSize}
        renderRowCard={(row: Row<Group>) => (
          <RowCard
            key={row.id}
            onOpen={() => setModal({ group: row.original, open: true })}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="min-w-0 truncate text-sm font-medium">
                {row.original.name}
              </span>
              <Badge variant="outline">{row.original.category?.name ?? "—"}</Badge>
            </div>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              {row.original.code} · {row.original._count?.voterMemberships ?? 0} voters
            </p>
          </RowCard>
        )}
        table={table}
        toolbar={
          <TableToolbar
            actions={
              <Button
                onClick={() => setModal({ group: null, open: true })}
                variant="brand"
              >
                <Plus className="size-4" /> New group
              </Button>
            }
            filters={filters}
            onClear={() => handleFiltersChange(clearAllFiltersPatch(filters))}
            onSearchChange={(value) => handleFiltersChange({ search: value || undefined })}
            search={filters.search ?? ""}
            searchPlaceholder="Search groups…"
          >
            <FilterField caption="Category">
              <Select
                onValueChange={(value) =>
                  handleFiltersChange({ categoryId: value === "all" ? undefined : value })
                }
                value={filters.categoryId ?? "all"}
              >
                <SelectTrigger className="w-full lg:w-48">
                  <SelectValue placeholder="All categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All categories</SelectItem>
                  {categories.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FilterField>
          </TableToolbar>
        }
        totalCount={totalCount}
      />

      <GroupModal
        categories={categories}
        group={modal.group}
        key={modal.group?.id ?? "new"}
        onClose={() => setModal({ group: null, open: false })}
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
        onOpenChange={(open) => !open && setDeleting(null)}
        open={deleting !== null}
        title="Delete this group?"
      />
    </>
  );
}

// --- Categories tab ---

interface CategoryFilters extends Record<string, string | undefined> {
  search?: string;
}

const CATEGORY_FILTERS_SPEC: TableFiltersSpec<CategoryFilters> = {
  search: { kind: "string" },
};

function CategoriesTab() {
  const { isSuperAdmin } = useAuthRole();
  const [modal, setModal] = useState<{ category: GroupCategory | null; open: boolean }>(
    { category: null, open: false },
  );
  const [deleting, setDeleting] = useState<GroupCategory | null>(null);
  const [deleteCategory] = useDeleteGroupCategoryMutation();

  const {
    filters,
    handleFiltersChange,
    handlePageChange,
    handlePageSizeChange,
    page,
    pageSize,
    queryParams,
  } = useTableQueryState<CategoryFilters>({
    prefix: "categories",
    spec: CATEGORY_FILTERS_SPEC,
  });

  const { data, isFetching, isLoading } = useListGroupCategoriesQuery(queryParams);
  const rows = data?.data ?? [];
  const totalCount = data?.meta.total ?? 0;

  const columns: ColumnDef<GroupCategory>[] = [
    {
      accessorKey: "name",
      cell: ({ row }) => (
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{row.original.name}</p>
          <p className="font-mono text-xs text-muted-foreground">{row.original.code}</p>
        </div>
      ),
      header: "Category",
    },
    {
      cell: ({ row }) => (
        <span className="text-sm tabular-nums text-muted-foreground">
          {row.original._count?.groups ?? 0}
        </span>
      ),
      header: "Groups",
      id: "groups",
    },
    {
      cell: ({ row }) =>
        row.original.allowMultiple ? (
          <Badge variant="outline">multiple allowed</Badge>
        ) : (
          <span className="text-xs text-muted-foreground">single</span>
        ),
      header: "Membership",
      id: "membership",
    },
    {
      cell: ({ row }) => (
        <div className="flex justify-end gap-1">
          <Button
            onClick={() => setModal({ category: row.original, open: true })}
            size="sm"
            variant="ghost"
          >
            Edit
          </Button>
          {isSuperAdmin && (
            <Button
              aria-label="Delete category"
              onClick={() => setDeleting(row.original)}
              size="icon-sm"
              variant="ghost"
            >
              <Trash2 className="size-4 text-destructive" />
            </Button>
          )}
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

  return (
    <>
      <DataTable
        emptyState={
          <EmptyState
            action={
              <Button
                onClick={() => setModal({ category: null, open: true })}
                variant="brand"
              >
                <Plus className="size-4" /> New category
              </Button>
            }
            description="Categories organize groups - e.g. a College category holding Science and Arts."
            icon={FolderTree}
            title="No categories yet"
          />
        }
        entityLabel="categories"
        filters={filters}
        loading={isLoading || isFetching}
        onClearFilters={() => handleFiltersChange(clearAllFiltersPatch(filters))}
        onPageChange={handlePageChange}
        onPageSizeChange={handlePageSizeChange}
        page={page}
        pageSize={pageSize}
        renderRowCard={(row: Row<GroupCategory>) => (
          <RowCard
            key={row.id}
            onOpen={() => setModal({ category: row.original, open: true })}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="min-w-0 truncate text-sm font-medium">
                {row.original.name}
              </span>
              <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
                {row.original._count?.groups ?? 0} groups
              </span>
            </div>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              {row.original.code}
              {row.original.allowMultiple ? " · multiple memberships" : ""}
            </p>
          </RowCard>
        )}
        table={table}
        toolbar={
          <TableToolbar
            actions={
              <Button
                onClick={() => setModal({ category: null, open: true })}
                variant="brand"
              >
                <Plus className="size-4" /> New category
              </Button>
            }
            filters={filters}
            onClear={() => handleFiltersChange(clearAllFiltersPatch(filters))}
            onSearchChange={(value) => handleFiltersChange({ search: value || undefined })}
            search={filters.search ?? ""}
            searchPlaceholder="Search categories…"
          />
        }
        totalCount={totalCount}
      />

      <CategoryModal
        category={modal.category}
        key={modal.category?.id ?? "new"}
        onClose={() => setModal({ category: null, open: false })}
        open={modal.open}
      />
      <ConfirmationDialog
        confirmText="Delete category"
        description={`"${deleting?.name ?? ""}" and its groups will be removed.`}
        isDestructive
        onConfirm={async () => {
          if (!deleting) return;
          setDeleting(null);
          try {
            const res = await deleteCategory(deleting.id).unwrap();
            pendingToast(res, "Category deleted");
          } catch (error) {
            toast.error(getApiErrorMessage(error));
          }
        }}
        onOpenChange={(open) => !open && setDeleting(null)}
        open={deleting !== null}
        title="Delete this category?"
      />
    </>
  );
}

export default function GroupsPage() {
  // Categories load once for the group modal/filter; a small stable list.
  const { data: categoriesData } = useListGroupCategoriesQuery({ limit: 100 });
  const categories = categoriesData?.data ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        description="The constituency system: categories hold groups, voters join groups, and elections scope eligibility by them."
        title="Groups"
      />
      <Tabs defaultValue="groups">
        <TabsList>
          <TabsTrigger value="groups">Groups</TabsTrigger>
          <TabsTrigger value="categories">Categories</TabsTrigger>
        </TabsList>
        <TabsContent className="mt-4" value="groups">
          <GroupsTab categories={categories} />
        </TabsContent>
        <TabsContent className="mt-4" value="categories">
          <CategoriesTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
