"use client";

// Compact search + period filter for the personal consoles (voter, agent,
// candidate): their election cards are client-side lists, so filtering is
// instant. "From" and "To" match any election whose voting window OVERLAPS
// the chosen period - "what ran (or runs) during this time".
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
    <div className="space-y-2 rounded-xl border border-border bg-card p-3">
      <div className="relative">
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
      <div className="grid grid-cols-2 gap-2">
        <label className="min-w-0">
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
        <label className="min-w-0">
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
