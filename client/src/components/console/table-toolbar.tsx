"use client";

// Shared filter toolbar for console data tables, mobile-first:
//
// - Phones/tablets (below lg): the search field is always visible and spans
//   the full width; beneath it a "Filters" toggle (with an active-count
//   badge) sits on the left and the page's action button(s) on the right.
//   The filters themselves live behind the toggle as a 2-col grid on phones
//   and a compact auto-fit grid on tablets - a control only spans a full row
//   when it genuinely can't fit beside another.
// - Desktop (lg up): the search row keeps the actions at its right end, and
//   ALL filters render inline on one row of their own, compact widths, with
//   Clear at the end.
import { ChevronDown, ListFilter, Search, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { hasActiveTableFilters } from "@/components/ui/table-empty-logic";
import { useDebounce } from "@/hooks/use-debounce";
import { cn } from "@/lib/utils";

/** Active non-search filters - drives the badge on the Filters toggle. */
const countActiveFilters = (filters: Record<string, unknown>): number =>
  Object.entries(filters).filter(
    ([key, value]) =>
      key !== "search" && value !== undefined && value !== null && value !== "",
  ).length;

/**
 * The search box owns its own input state and commits it debounced (500ms),
 * so typing never fires a request per keystroke. `lastEmitted` tells our own
 * commits apart from external changes (URL navigation, session restore,
 * clear-all) - the input resyncs on the latter, never mid-typing.
 */
function DebouncedSearch({
  committed,
  onCommit,
  placeholder,
}: {
  committed: string;
  onCommit: (value: string) => void;
  placeholder: string;
}) {
  const [searchInput, setSearchInput] = useState(committed);
  const debouncedSearch = useDebounce(searchInput, 500);
  const lastEmitted = useRef(committed);

  useEffect(() => {
    const next = debouncedSearch.trim();
    if (next !== lastEmitted.current) {
      lastEmitted.current = next;
      onCommit(next);
    }
    // onCommit wraps useTableQueryState's stable handler; an inline arrow at
    // the call site must not re-fire the debounce effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch]);

  useEffect(() => {
    if (committed !== lastEmitted.current) {
      lastEmitted.current = committed;
      setSearchInput(committed);
    }
  }, [committed]);

  return (
    <div className="relative w-full sm:max-w-xs">
      <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        className="pr-8 pl-9"
        onChange={(e) => {
          setSearchInput(e.target.value);
        }}
        placeholder={placeholder}
        value={searchInput}
      />
      {searchInput && (
        <button
          aria-label="Clear search"
          className="absolute top-1/2 right-2 grid size-5 -translate-y-1/2 place-items-center text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          onClick={() => {
            lastEmitted.current = "";
            setSearchInput("");
            onCommit("");
          }}
          type="button"
        >
          <X className="size-3.5" />
        </button>
      )}
    </div>
  );
}

export function TableToolbar({
  actions,
  children,
  filters,
  onClear,
  onSearchChange,
  search = "",
  searchPlaceholder = "Search…",
}: {
  /** Page action button(s), e.g. the create button. */
  actions?: React.ReactNode;
  /** Filter controls - wrap each in a FilterField. */
  children?: React.ReactNode;
  /** The table's current filters - drives clear-all and the count badge. */
  filters: Record<string, unknown>;
  onClear: () => void;
  /** Omit to render a toolbar without a search box. */
  onSearchChange?: (value: string) => void;
  search?: string;
  searchPlaceholder?: string;
}) {
  const [filtersOpen, setFiltersOpen] = useState(false);
  const panelId = useId();
  const active = hasActiveTableFilters(filters);
  const activeCount = countActiveFilters(filters);
  const hasFilters = Boolean(children);

  return (
    <div className="flex flex-col gap-3">
      {/* Search row - actions join it right-aligned from lg. */}
      {(onSearchChange || actions) && (
        <div className="flex items-center gap-3">
          {onSearchChange && (
            <DebouncedSearch
              committed={search}
              onCommit={onSearchChange}
              placeholder={searchPlaceholder}
            />
          )}
          {actions && (
            <div className="ml-auto hidden items-center gap-2 lg:flex">{actions}</div>
          )}
        </div>
      )}

      {/* Below lg: Filters toggle + clear left, actions right. */}
      {(hasFilters || actions) && (
        <div className="flex w-full flex-wrap items-center gap-2 lg:hidden">
          {hasFilters && (
            <Button
              aria-controls={panelId}
              aria-expanded={filtersOpen}
              onClick={() => setFiltersOpen((open) => !open)}
              size="sm"
              type="button"
              variant="outline"
            >
              <ListFilter className="size-4" /> Filters
              {activeCount > 0 && (
                <span className="grid size-4.5 place-items-center rounded-full bg-brand text-[10px] font-bold text-brand-foreground">
                  {activeCount}
                </span>
              )}
              <ChevronDown
                className={cn("size-3.5 transition-transform", filtersOpen && "rotate-180")}
              />
            </Button>
          )}
          {active && (
            <Button onClick={onClear} size="sm" type="button" variant="ghost">
              <X className="size-4" /> Clear
            </Button>
          )}
          {actions && (
            <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
              {actions}
            </div>
          )}
        </div>
      )}

      {/* The filters. Phones: 2-col grid behind the toggle; tablets: compact
          auto-fit columns; lg+: always visible on their own row below the
          search. */}
      {hasFilters && (
        <div
          className={cn(
            "w-full grid-cols-2 gap-3 sm:grid-cols-[repeat(auto-fit,minmax(160px,1fr))] lg:flex lg:flex-wrap lg:items-end",
            filtersOpen ? "grid" : "hidden lg:flex",
          )}
          id={panelId}
        >
          {children}
          {active && (
            <div className="hidden lg:flex">
              <Button onClick={onClear} size="sm" type="button" variant="ghost">
                <X className="size-4" /> Clear filters
              </Button>
            </div>
          )}
        </div>
      )}

    </div>
  );
}

/**
 * A captioned filter control: a small muted label above the select/input so
 * anyone can tell what the filter does without guessing. Wrap every
 * non-search toolbar filter in one of these. Fills its grid cell below lg;
 * shrinks to the control's own compact width on the lg single row.
 */
export function FilterField({
  caption,
  children,
}: {
  caption: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex w-full min-w-0 flex-col gap-1 lg:w-auto">
      <span className="text-[11px] font-medium text-muted-foreground">{caption}</span>
      {children}
    </div>
  );
}
