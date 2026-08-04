"use client";

// Group multi-select: checkboxes grouped by category, used wherever an
// election or portfolio scopes eligibility to groups.
import type { Group } from "@/types/api";

import { Skeleton } from "@/components/ui/skeleton";
import { useListGroupsQuery } from "@/redux/governance-api";

/** Group a flat group list by category name, preserving list order. */
export const groupsByCategory = (groups: Group[]): [string, Group[]][] => {
  const map = new Map<string, Group[]>();
  for (const group of groups) {
    const category = group.category?.name ?? "Other";
    const list = map.get(category) ?? [];
    list.push(group);
    map.set(category, list);
  }
  return [...map.entries()];
};

export function GroupPicker({
  error,
  onChange,
  value,
}: {
  error?: string;
  onChange: (groupIds: string[]) => void;
  value: string[];
}) {
  const { data, isLoading } = useListGroupsQuery({ limit: 100 });
  const groups = data?.data ?? [];

  if (isLoading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-5 w-52" />
      </div>
    );
  }
  if (groups.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        No groups exist yet - create them under Groups first.
      </p>
    );
  }

  const toggle = (groupId: string) => {
    onChange(
      value.includes(groupId)
        ? value.filter((id) => id !== groupId)
        : [...value, groupId],
    );
  };

  return (
    <div className="space-y-3">
      {groupsByCategory(groups).map(([category, categoryGroups]) => (
        <fieldset key={category}>
          <legend className="mb-1 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
            {category}
          </legend>
          <div className="grid grid-cols-1 gap-1.5 min-[360px]:grid-cols-2">
            {categoryGroups.map((group) => (
              <label className="flex min-w-0 items-center gap-2 text-sm" key={group.id}>
                <input
                  checked={value.includes(group.id)}
                  className="size-4 shrink-0 accent-brand"
                  onChange={() => {
                    toggle(group.id);
                  }}
                  type="checkbox"
                />
                <span className="min-w-0 [overflow-wrap:anywhere]">{group.name}</span>
              </label>
            ))}
          </div>
        </fieldset>
      ))}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
