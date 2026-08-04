"use client";

// Staff user management: every non-voter account (admins, agents,
// candidates, accreditors, super-admins). Create accounts, edit names and
// status, change roles, unlock locked accounts, and delete - each action
// confirmation-gated and audited by the backend.
import { type ColumnDef, type Row } from "@tanstack/react-table";
import {
  KeyRound,
  Pencil,
  Plus,
  ShieldAlert,
  Trash2,
  UserCog,
  Users,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import type { StaffUser } from "@/types/api";

import { RowActionsMenu } from "@/components/console/row-actions";
import { FilterField, TableToolbar } from "@/components/console/table-toolbar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { DataTable, useDataTable } from "@/components/ui/data-table";
import {
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
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
import { StatusBadge } from "@/components/ui/status-badge";
import { RowCard } from "@/components/ui/table-bits";
import { clearAllFiltersPatch } from "@/components/ui/table-empty-logic";
import { useAuthRole } from "@/hooks/use-auth-role";
import { type TableFiltersSpec } from "@/hooks/table-query-state-logic";
import { useTableQueryState } from "@/hooks/use-table-query-state";
import {
  useCreateStaffUserMutation,
  useDeleteStaffUserMutation,
  useListStaffUsersQuery,
  useUnlockUserMutation,
  useUpdateStaffUserMutation,
  useUpdateUserRoleMutation,
} from "@/redux/governance-api";
import { getApiErrorMessage } from "@/utils/extract-api-error";

const CREATABLE_ROLES = ["ADMIN", "AGENT", "CANDIDATE", "ACCREDITOR"] as const;
const ALL_ROLES = ["SUPER_ADMIN", ...CREATABLE_ROLES] as const;
const STATUSES = ["ACTIVE", "INACTIVE", "SUSPENDED", "LOCKED"] as const;

const ROLE_LABELS: Record<string, string> = {
  ACCREDITOR: "Accreditor",
  ADMIN: "Administrator",
  AGENT: "Agent",
  CANDIDATE: "Candidate",
  SUPER_ADMIN: "Super admin",
};

interface UserFilters extends Record<string, string | undefined> {
  from?: string;
  role?: string;
  search?: string;
  status?: string;
  to?: string;
}

const FILTERS_SPEC: TableFiltersSpec<UserFilters> = {
  from: { kind: "string" },
  role: { kind: "enum", values: ALL_ROLES },
  search: { kind: "string" },
  status: { kind: "enum", values: STATUSES },
  to: { kind: "string" },
};

function CreateUserModal({ onClose, open }: { onClose: () => void; open: boolean }) {
  const [create, { isLoading: creating }] = useCreateStaffUserMutation();

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    try {
      await create({
        email: f.get("email"),
        firstName: f.get("firstName"),
        lastName: f.get("lastName"),
        password: f.get("password"),
        phone: f.get("phone") || undefined,
        role: f.get("role"),
      }).unwrap();
      toast.success("Account created");
      onClose();
    } catch (error) {
      toast.error(getApiErrorMessage(error));
    }
  };

  return (
    <Modal
      description="They can sign in immediately and should change this password."
      onClose={onClose}
      open={open}
      title="New staff account"
    >
      <form className="space-y-4" onSubmit={onSubmit}>
        <div className="grid grid-cols-2 gap-3">
          <Field label="First name">
            <Input name="firstName" placeholder="e.g. Ama" required />
          </Field>
          <Field label="Last name">
            <Input name="lastName" placeholder="e.g. Owusu" required />
          </Field>
        </div>
        <Field label="Email">
          <Input name="email" placeholder="e.g. ama@org.com" required type="email" />
        </Field>
        <Field label="Phone">
          <Input name="phone" placeholder="e.g. +233 24 000 0000 (optional)" type="tel" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Role">
            <NativeSelect defaultValue="ADMIN" name="role">
              {CREATABLE_ROLES.map((role) => (
                <option key={role} value={role}>
                  {ROLE_LABELS[role]}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field hint="8+ chars, mixed case + digit" label="Temporary password">
            <Input name="password" placeholder="Temporary password" required type="password" />
          </Field>
        </div>
        <Button className="w-full" loading={creating} type="submit" variant="brand">
          Create account
        </Button>
      </form>
    </Modal>
  );
}

function EditUserModal({
  onClose,
  user,
}: {
  onClose: () => void;
  user: null | StaffUser;
}) {
  const [update, { isLoading: saving }] = useUpdateStaffUserMutation();

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user) return;
    const f = new FormData(e.currentTarget);
    try {
      await update({
        data: {
          firstName: f.get("firstName"),
          lastName: f.get("lastName"),
          status: f.get("status"),
        },
        id: user.id,
      }).unwrap();
      toast.success("Account updated");
      onClose();
    } catch (error) {
      toast.error(getApiErrorMessage(error));
    }
  };

  return (
    <Modal onClose={onClose} open={Boolean(user)} title="Edit account">
      {user && (
        <form className="space-y-4" onSubmit={onSubmit}>
          <div className="grid grid-cols-2 gap-3">
            <Field label="First name">
              <Input defaultValue={user.firstName} name="firstName" required />
            </Field>
            <Field label="Last name">
              <Input defaultValue={user.lastName} name="lastName" required />
            </Field>
          </div>
          <Field
            hint="Suspending signs the user out of every device."
            label="Status"
          >
            <NativeSelect defaultValue={user.status} name="status">
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
              <option value="SUSPENDED">Suspended</option>
            </NativeSelect>
          </Field>
          <Button className="w-full" loading={saving} type="submit" variant="brand">
            Save changes
          </Button>
        </form>
      )}
    </Modal>
  );
}

function ChangeRoleModal({
  onClose,
  user,
}: {
  onClose: () => void;
  user: null | StaffUser;
}) {
  const [updateRole] = useUpdateUserRoleMutation();
  const [role, setRole] = useState<string>("");
  const [confirming, setConfirming] = useState(false);

  const chosen = role || user?.role || "ADMIN";

  return (
    <>
      <Modal
        description="Role changes sign the user out everywhere so the new role binds immediately."
        onClose={onClose}
        open={Boolean(user) && !confirming}
        title="Change role"
      >
        {user && (
          <div className="space-y-4">
            <Field label="Role">
              <NativeSelect
                onChange={(e) => setRole(e.target.value)}
                value={chosen}
              >
                {CREATABLE_ROLES.map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABELS[r]}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Button
              className="w-full"
              disabled={chosen === user.role}
              onClick={() => setConfirming(true)}
              variant="brand"
            >
              Continue
            </Button>
          </div>
        )}
      </Modal>
      <ConfirmationDialog
        confirmText="Change role"
        description={`${user?.firstName ?? ""} ${user?.lastName ?? ""} becomes ${ROLE_LABELS[chosen] ?? chosen} and is signed out of every device.`}
        isDestructive
        onConfirm={async () => {
          if (!user) return;
          setConfirming(false);
          try {
            await updateRole({ id: user.id, role: chosen }).unwrap();
            toast.success("Role updated");
            onClose();
          } catch (error) {
            toast.error(getApiErrorMessage(error));
          }
        }}
        onOpenChange={(open) => !open && setConfirming(false)}
        open={confirming}
        title="Change this user's role?"
      />
    </>
  );
}

function UserActions({
  onDelete,
  onEdit,
  onRole,
  user,
}: {
  onDelete: (user: StaffUser) => void;
  onEdit: (user: StaffUser) => void;
  onRole: (user: StaffUser) => void;
  user: StaffUser;
}) {
  const { isSuperAdmin, user: me } = useAuthRole();
  const [unlock] = useUnlockUserMutation();
  const isSelf = me?.id === user.id;

  return (
    <RowActionsMenu label="Account actions">
        <DropdownMenuItem onClick={() => onEdit(user)}>
          <Pencil className="size-4" /> Edit
        </DropdownMenuItem>
        {isSuperAdmin && !isSelf && user.role !== "SUPER_ADMIN" && (
          <DropdownMenuItem onClick={() => onRole(user)}>
            <UserCog className="size-4" /> Change role
          </DropdownMenuItem>
        )}
        {isSuperAdmin && user.lockedAt && (
          <DropdownMenuItem
            onClick={async () => {
              try {
                await unlock(user.id).unwrap();
                toast.success("Account unlocked");
              } catch (error) {
                toast.error(getApiErrorMessage(error));
              }
            }}
          >
            <KeyRound className="size-4" /> Unlock account
          </DropdownMenuItem>
        )}
        {isSuperAdmin && !isSelf && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => onDelete(user)} variant="destructive">
              <Trash2 className="size-4" /> Delete
            </DropdownMenuItem>
          </>
        )}
    </RowActionsMenu>
  );
}

export default function UsersPage() {
  const { isSuperAdmin } = useAuthRole();
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<null | StaffUser>(null);
  const [changingRole, setChangingRole] = useState<null | StaffUser>(null);
  const [deleting, setDeleting] = useState<null | StaffUser>(null);
  const [deleteUser] = useDeleteStaffUserMutation();

  const {
    filters,
    handleFiltersChange,
    handlePageChange,
    handlePageSizeChange,
    page,
    pageSize,
    queryParams,
  } = useTableQueryState<UserFilters>({ spec: FILTERS_SPEC });

  const { data, isFetching, isLoading } = useListStaffUsersQuery(queryParams);
  const rows = data?.data ?? [];
  const totalCount = data?.meta.total ?? 0;

  const columns: ColumnDef<StaffUser>[] = [
    {
      accessorKey: "firstName",
      cell: ({ row }) => (
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">
            {row.original.firstName} {row.original.lastName}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {row.original.email ?? row.original.phone ?? "—"}
          </p>
        </div>
      ),
      header: "Account",
    },
    {
      cell: ({ row }) => (
        <Badge variant="outline">{ROLE_LABELS[row.original.role]}</Badge>
      ),
      header: "Role",
      id: "role",
    },
    {
      cell: ({ row }) => (
        <div className="flex items-center gap-1.5">
          <StatusBadge status={row.original.status} />
          {row.original.lockedAt && (
            <Badge variant="destructive">
              <ShieldAlert className="size-3" /> locked
            </Badge>
          )}
        </div>
      ),
      header: "Status",
      id: "status",
    },
    {
      accessorKey: "createdAt",
      cell: ({ row }) => (
        <time className="text-xs whitespace-nowrap tabular-nums text-muted-foreground">
          {new Date(row.original.createdAt).toLocaleDateString()}
        </time>
      ),
      header: "Created",
    },
    {
      cell: ({ row }) => (
        <UserActions
          onDelete={setDeleting}
          onEdit={setEditing}
          onRole={setChangingRole}
          user={row.original}
        />
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
        description="Every staff account: administrators, agents, candidates, and accreditation officers."
        title="Users"
      />

      <DataTable
        emptyState={
          <EmptyState
            description="Create accounts for the people running your elections."
            icon={Users}
            title="No staff accounts yet"
          />
        }
        entityLabel="users"
        filters={filters}
        loading={isLoading || isFetching}
        onClearFilters={() => handleFiltersChange(clearAllFiltersPatch(filters))}
        onPageChange={handlePageChange}
        onPageSizeChange={handlePageSizeChange}
        page={page}
        pageSize={pageSize}
        renderRowCard={(row: Row<StaffUser>) => (
          <RowCard
            action={
              <UserActions
                onDelete={setDeleting}
                onEdit={setEditing}
                onRole={setChangingRole}
                user={row.original}
              />
            }
            key={row.id}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="min-w-0 truncate text-sm font-medium">
                {row.original.firstName} {row.original.lastName}
              </span>
              <Badge variant="outline">{ROLE_LABELS[row.original.role]}</Badge>
            </div>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              {row.original.email ?? row.original.phone ?? "—"} ·{" "}
              {row.original.status.toLowerCase()}
              {row.original.lockedAt ? " · locked" : ""}
            </p>
          </RowCard>
        )}
        table={table}
        toolbar={
          <TableToolbar
            actions={
              isSuperAdmin ? (
                <Button onClick={() => setCreateOpen(true)} variant="brand">
                  <Plus className="size-4" /> New account
                </Button>
              ) : undefined
            }
            filters={filters}
            onClear={() => handleFiltersChange(clearAllFiltersPatch(filters))}
            onSearchChange={(value) => handleFiltersChange({ search: value || undefined })}
            search={filters.search ?? ""}
            searchPlaceholder="Search by name or email…"
          >
            <FilterField caption="Role">
              <Select
                onValueChange={(value) =>
                  handleFiltersChange({ role: value === "all" ? undefined : value })
                }
                value={filters.role ?? "all"}
              >
                <SelectTrigger className="w-full lg:w-40">
                  <SelectValue placeholder="All roles" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All roles</SelectItem>
                  {ALL_ROLES.map((role) => (
                    <SelectItem key={role} value={role}>
                      {ROLE_LABELS[role]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FilterField>
            <FilterField caption="Status">
              <Select
                onValueChange={(value) =>
                  handleFiltersChange({ status: value === "all" ? undefined : value })
                }
                value={filters.status ?? "all"}
              >
                <SelectTrigger className="w-full lg:w-36">
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  {STATUSES.map((status) => (
                    <SelectItem key={status} value={status}>
                      {status.charAt(0) + status.slice(1).toLowerCase()}
                    </SelectItem>
                  ))}
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

      <CreateUserModal onClose={() => setCreateOpen(false)} open={createOpen} />
      <EditUserModal
        key={editing?.id ?? "edit"}
        onClose={() => setEditing(null)}
        user={editing}
      />
      <ChangeRoleModal
        key={changingRole?.id ?? "role"}
        onClose={() => setChangingRole(null)}
        user={changingRole}
      />
      <ConfirmationDialog
        confirmText="Delete account"
        description={`${deleting?.firstName ?? ""} ${deleting?.lastName ?? ""}'s account will be removed and signed out everywhere. It can be restored from Deleted records.`}
        isDestructive
        onConfirm={async () => {
          if (!deleting) return;
          setDeleting(null);
          try {
            await deleteUser(deleting.id).unwrap();
            toast.success("Account deleted");
          } catch (error) {
            toast.error(getApiErrorMessage(error));
          }
        }}
        onOpenChange={(open) => !open && setDeleting(null)}
        open={deleting !== null}
        requireExactMatch="delete"
        title="Delete this account?"
      />
    </div>
  );
}
