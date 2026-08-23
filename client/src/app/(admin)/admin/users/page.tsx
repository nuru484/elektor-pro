"use client";

// Staff user management: every non-voter account (admins, agents,
// candidates, accreditors, super-admins). Create accounts, edit names and
// status, change roles, unlock locked accounts, and delete - each action
// confirmation-gated and audited by the backend.
import { type ColumnDef, type Row } from "@tanstack/react-table";
import {
  Eye,
  KeyRound,
  Lock,
  Pencil,
  Plus,
  ShieldAlert,
  Trash2,
  UserCog,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";

import type { StaffUser } from "@/types/api";

import { EntityAvatar } from "@/components/console/entity-avatar";
import { PhotoInput } from "@/components/console/photo-input";
import { RowActionsMenu } from "@/components/console/row-actions";
import { TableDate } from "@/components/console/table-date";
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
  useLockUserMutation,
  useUnlockUserMutation,
  useUpdateUserRoleMutation,
} from "@/redux/governance-api";
import { getApiErrorMessage } from "@/utils/extract-api-error";
import { type FormErrors, isValidEmail, validateRequired } from "@/utils/form-validate";

// Staff only: agents, candidates, and voters live in their own modules.
const CREATABLE_ROLES = ["ADMIN", "ACCREDITOR"] as const;
const ALL_ROLES = ["SUPER_ADMIN", "ADMIN", "ACCREDITOR"] as const;
const STATUSES = ["ACTIVE", "INACTIVE", "SUSPENDED", "LOCKED"] as const;

const ROLE_LABELS: Record<string, string> = {
  ACCREDITOR: "Accreditor",
  ADMIN: "Administrator",
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
  const [tempPassword, setTempPassword] = useState<null | string>(null);
  const [photo, setPhoto] = useState<File | null>(null);
  const [errors, setErrors] = useState<FormErrors>({});

  const close = () => {
    setTempPassword(null);
    setPhoto(null);
    onClose();
  };

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const errs = validateRequired(f, {
      email: "Email",
      firstName: "First name",
      lastName: "Last name",
    });
    const emailValue = String(f.get("email") ?? "");
    if (emailValue && !isValidEmail(emailValue)) errs.email = "Enter a valid email address";
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;
    const body = new FormData();
    body.append("firstName", String(f.get("firstName")));
    body.append("lastName", String(f.get("lastName")));
    body.append("email", String(f.get("email")));
    if (f.get("phone")) body.append("phone", String(f.get("phone")));
    body.append("role", String(f.get("role")));
    if (photo) body.append("image", photo);
    try {
      const res = (await create(body).unwrap()) as {
        data?: { temporaryPassword?: string };
      };
      toast.success("Account created");
      setPhoto(null);
      setTempPassword(res.data?.temporaryPassword ?? null);
    } catch (error) {
      toast.error(getApiErrorMessage(error));
    }
  };

  return (
    <Modal
      description={
        tempPassword
          ? undefined
          : "The system generates a temporary password and emails it to them; they must set their own on first sign-in."
      }
      onClose={close}
      open={open}
      title={tempPassword ? "Account created" : "New staff account"}
    >
      {tempPassword ? (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Share this temporary password with the new user - it is shown only
            once (they also receive it by email). They will be asked to set
            their own password on first sign-in.
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 rounded-lg border border-border bg-muted/40 px-3 py-2 text-center font-mono text-lg tracking-wider">
              {tempPassword}
            </code>
            <Button
              onClick={async () => {
                await navigator.clipboard.writeText(tempPassword);
                toast.success("Copied");
              }}
              size="sm"
              type="button"
              variant="outline"
            >
              Copy
            </Button>
          </div>
          <Button className="w-full" onClick={close} variant="brand">
            Done
          </Button>
        </div>
      ) : (
        <form className="space-y-4" noValidate onSubmit={onSubmit}>
          <div className="grid grid-cols-2 gap-3">
            <Field error={errors.firstName} label="First name">
              <Input name="firstName" placeholder="e.g. Ama" required />
            </Field>
            <Field error={errors.lastName} label="Last name">
              <Input name="lastName" placeholder="e.g. Owusu" required />
            </Field>
          </div>
          <Field error={errors.email} label="Email">
            <Input name="email" placeholder="e.g. ama@org.com" required type="email" />
          </Field>
          <Field label="Phone">
            <Input name="phone" placeholder="e.g. +233 24 000 0000 (optional)" type="tel" />
          </Field>
          <Field label="Role">
            <NativeSelect defaultValue="ADMIN" name="role">
              {CREATABLE_ROLES.map((role) => (
                <option key={role} value={role}>
                  {ROLE_LABELS[role]}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <PhotoInput file={photo} onChange={setPhoto} />
          <Button className="w-full" loading={creating} type="submit" variant="brand">
            Create account
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
                {ALL_ROLES.map((r) => (
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
  onLock,
  onRole,
  user,
}: {
  onDelete: (user: StaffUser) => void;
  onLock: (user: StaffUser) => void;
  onRole: (user: StaffUser) => void;
  user: StaffUser;
}) {
  const { isAdmin, isSuperAdmin, user: me } = useAuthRole();
  const [unlock] = useUnlockUserMutation();
  const isSelf = me?.id === user.id;

  return (
    <RowActionsMenu label="Account actions">
        <DropdownMenuItem asChild>
          <Link href={`/admin/users/${user.id}`}>
            <Eye className="size-4" /> View profile
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href={`/admin/users/${user.id}?edit=1`}>
            <Pencil className="size-4" /> Edit
          </Link>
        </DropdownMenuItem>
        {isAdmin && !isSelf && !user.lockedAt && (
          <DropdownMenuItem onClick={() => onLock(user)}>
            <Lock className="size-4" /> Lock account
          </DropdownMenuItem>
        )}
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
  const { isSuperAdmin, user: me } = useAuthRole();
  const [createOpen, setCreateOpen] = useState(false);
  const [locking, setLocking] = useState<null | StaffUser>(null);
  const [changingRole, setChangingRole] = useState<null | StaffUser>(null);
  const [deleting, setDeleting] = useState<null | StaffUser>(null);
  const [deleteUser] = useDeleteStaffUserMutation();
  const [lockUser] = useLockUserMutation();

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
        <div className="flex min-w-0 items-center gap-2.5">
          <EntityAvatar
            name={`${row.original.firstName} ${row.original.lastName}`}
            url={row.original.profilePicture}
          />
          <p className="flex min-w-0 max-w-[90%] items-center gap-1.5 text-sm font-medium">
            <span
              className="min-w-0 truncate"
              title={`${row.original.firstName} ${row.original.lastName}`}
            >
              {row.original.firstName} {row.original.lastName}
            </span>
            {me?.id === row.original.id && (
              <Badge className="shrink-0" variant="brand">
                You
              </Badge>
            )}
          </p>
        </div>
      ),
      header: "Name",
      meta: { stretch: true },
    },
    {
      accessorKey: "email",
      cell: ({ row }) => (
        // Only the stretch column is width-capped by the table, so truncate
        // needs an explicit max here or a long address just widens the column
        // and pushes the row into a horizontal scroll. The title carries the
        // full address for whatever gets cut.
        <p
          className="max-w-[24ch] truncate text-sm"
          title={row.original.email ?? undefined}
        >
          {row.original.email ?? "—"}
        </p>
      ),
      header: "Email",
    },
    {
      accessorKey: "phone",
      cell: ({ row }) => (
        <p className="text-sm whitespace-nowrap tabular-nums">
          {row.original.phone ?? "—"}
        </p>
      ),
      header: "Phone",
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
          {/* The extra badge only covers a lock that status doesn't already say. */}
          {row.original.lockedAt && row.original.status !== "LOCKED" && (
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
<TableDate value={row.original.createdAt} />
      ),
      header: "Created",
    },
    {
      cell: ({ row }) => (
        <UserActions
          onDelete={setDeleting}
          onLock={setLocking}
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
        description="Staff accounts: super administrators, administrators, and accreditation officers."
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
                onLock={setLocking}
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
              <NativeSelect
                className="w-full lg:w-40"
                onChange={(e) =>
                  handleFiltersChange({
                    role: e.target.value === "all" ? undefined : e.target.value,
                  })
                }
                value={filters.role ?? "all"}
              >
                <option value="all">All roles</option>
                {ALL_ROLES.map((role) => (
                  <option key={role} value={role}>
                    {ROLE_LABELS[role]}
                  </option>
                ))}
              </NativeSelect>
            </FilterField>
            <FilterField caption="Status">
              <NativeSelect
                className="w-full lg:w-36"
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
      <ConfirmationDialog
        confirmText="Lock account"
        description={`${locking?.firstName ?? ""} ${locking?.lastName ?? ""} will be signed out everywhere and unable to sign in until a super administrator unlocks the account.`}
        isDestructive
        onConfirm={async () => {
          if (!locking) return;
          setLocking(null);
          try {
            await lockUser(locking.id).unwrap();
            toast.success("Account locked");
          } catch (error) {
            toast.error(getApiErrorMessage(error));
          }
        }}
        onOpenChange={(open) => !open && setLocking(null)}
        open={locking !== null}
        title="Lock this account?"
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
