"use client";

// Compact search + period filter for the personal consoles (voter,
// candidate): their election cards are client-side lists, so filtering is
// instant. "From" and "To" match any election whose voting window OVERLAPS
// the chosen period - "what ran (or runs) during this time".
//
// Layout: there are only three controls, so from lg they share one row with
// the search taking the slack. Below that the search keeps its own row and
// the two dates split one - a date input is unusable squeezed into a third
// of a phone screen. No card wrapper: the consoles that mount this already
// sit inside a padded shell, and nesting a second padded box just eats
// horizontal space on phones.
import { X } from "lucide-react";

import { Input } from "@/components/ui/input";

export interface ElectionFilter {
  from: string;
  search: string;
  to: string;
}

export const EMPTY_ELECTION_FILTER: ElectionFilter = { from: "", search: "", to: "" };

export function ElectionFilterBar({
  filter,
  onChange,
}: {
  filter: ElectionFilter;
  onChange: (next: ElectionFilter) => void;
}) {
  const active = filter.search !== "" || filter.from !== "" || filter.to !== "";
  return (
    <div className="space-y-2">
      <div className="flex flex-col gap-2 lg:flex-row lg:items-end">
      <div className="relative lg:flex-1">
        <Input
          className="pr-9"
          onChange={(e) => {
            onChange({ ...filter, search: e.target.value });
          }}
          placeholder="Search elections by name…"
          title="Filter the cards below by election name"
          value={filter.search}
        />
        {filter.search.length > 0 && (
          <button
            aria-label="Clear search"
            className="absolute inset-y-0 right-0 flex w-9 items-center justify-center text-muted-foreground hover:text-foreground"
            onClick={() => {
              onChange({ ...filter, search: "" });
            }}
            title="Clear search"
            type="button"
          >
            <X className="size-4" />
          </button>
        )}
      </div>
      <div className="grid grid-cols-2 gap-2 lg:w-auto lg:flex-none">
        <label className="min-w-0 lg:w-40">
          <span className="text-[11px] font-medium text-muted-foreground">From</span>
          <Input
            onChange={(e) => {
              onChange({ ...filter, from: e.target.value });
            }}
            title="Show elections whose voting window reaches this date or later"
            type="date"
            value={filter.from}
          />
        </label>
        <label className="min-w-0 lg:w-40">
          <span className="text-[11px] font-medium text-muted-foreground">To</span>
          <Input
            onChange={(e) => {
              onChange({ ...filter, to: e.target.value });
            }}
            title="Show elections whose voting window starts by this date"
            type="date"
            value={filter.to}
          />
        </label>
      </div>
      </div>
      {active && (
        <button
          className="text-xs font-medium text-muted-foreground hover:text-foreground"
          onClick={() => {
            onChange(EMPTY_ELECTION_FILTER);
          }}
          type="button"
        >
          Clear all filters
        </button>
      )}
    </div>
  );
}
