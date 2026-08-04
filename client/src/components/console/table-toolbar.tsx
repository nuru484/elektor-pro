"use client";

// Shared filter toolbar for console data tables: a search box, any number of
// filter controls, and a clear-all action when something is active.
import { Search, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { hasActiveTableFilters } from "@/components/ui/table-empty-logic";

export function TableToolbar({
  children,
  filters,
  onClear,
  onSearchChange,
  search,
  searchPlaceholder = "Search…",
}: {
  /** Extra filter controls (selects etc.) rendered beside the search box. */
  children?: React.ReactNode;
  /** The table's current filters - drives the clear-all visibility. */
  filters: Record<string, unknown>;
  onClear: () => void;
  onSearchChange: (value: string) => void;
  search: string;
  searchPlaceholder?: string;
}) {
  const active = hasActiveTableFilters(filters);

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
      <div className="relative w-full sm:max-w-xs">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="pl-9"
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={searchPlaceholder}
          value={search}
        />
      </div>
      {children}
      {active && (
        <Button onClick={onClear} size="sm" type="button" variant="ghost">
          <X className="size-4" /> Clear filters
        </Button>
      )}
    </div>
  );
}
