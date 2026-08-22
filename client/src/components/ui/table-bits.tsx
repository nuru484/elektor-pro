// src/components/ui/table-bits.tsx
//
// Building blocks for the dual-render list pattern: below `md` every data
// table renders as a dense, tappable row-card list (all of a row's key data,
// no side-scroll), while `hidden md:block` keeps the real <table> from `md`
// up. Row cards follow the admin list-row convention: meta (badges/date) on
// the top line, name/content below, size-3 icons inside h-6 action buttons.
"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";

/**
 * The mobile half of a list page. Pair with `hidden md:block` on the table's
 * scroll wrapper; both halves live inside the same bordered container.
 */
export function RowCardList({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <ul role="list" className={cn("md:hidden", className)}>
      {children}
    </ul>
  );
}

/**
 * One row of a RowCardList: a dense, stacked list row (meta line on top,
 * name/content below), not a card. `onOpen` makes the whole row tappable
 * (the card counterpart of a row's "View" action); `leading` hosts the
 * selection checkbox and `action` the actions menu - both are isolated from
 * the row tap so they never trigger navigation.
 */
export function RowCard({
  onOpen,
  leading,
  action,
  className,
  children,
}: {
  onOpen?: () => void;
  /** Control on the left edge (typically a selection Checkbox). */
  leading?: ReactNode;
  /** Control on the right edge (typically a compact actions dropdown). */
  action?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <li
      onClick={onOpen}
      className={cn(
        "flex items-center gap-2 border-b border-border py-2.5 transition-colors last:border-0",
        onOpen && "cursor-pointer active:bg-muted/50",
        leading ? "pl-2" : "pl-3",
        action ? "pr-1.5" : "pr-3",
        className,
      )}
    >
      {leading ? (
        <div
          className="flex flex-none items-center"
          onClick={(e) => e.stopPropagation()}
        >
          {leading}
        </div>
      ) : null}
      <div className="min-w-0 flex-1">{children}</div>
      {action ? (
        <div className="flex-none" onClick={(e) => e.stopPropagation()}>
          {action}
        </div>
      ) : null}
    </li>
  );
}

/** Compact Badge sizing for dense list rows (pass as its className). */
export const ROW_BADGE = "px-1.5 py-px text-[10px] tracking-[0.04em]";

/**
 * Pulsing placeholder rows shaped like a RowCard (checkbox, meta line,
 * title + subtitle, action button) - the mobile counterpart of the table
 * skeleton, mirroring the real content rather than a generic block.
 */
export function SkeletonRowCards({ rows = 8 }: { rows?: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, index) => (
        <li
          key={index}
          className="flex items-center gap-2 border-b border-border py-2.5 pl-2 pr-1.5 last:border-0"
        >
          <Skeleton className="h-4 w-4 flex-none rounded-sm" />
          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <Skeleton className="h-4 w-16 rounded-full" />
              <Skeleton className="h-3 w-14" />
            </div>
            <Skeleton className="h-4 w-3/5" />
            <Skeleton className="h-3 w-2/5" />
          </div>
          <Skeleton className="h-6 w-6 flex-none rounded-md" />
        </li>
      ))}
    </>
  );
}

/**
 * Filters/search are active but matched nothing (table-empty-logic
 * "filtered-empty"): the toolbar stays, the body offers a clear action.
 * Rendered by BOTH halves of the dual-render pattern (row-card list and the
 * md+ table's spanning cell).
 */
export function FilteredEmpty({
  entityLabel,
  onClear,
}: {
  /** Plural noun for the copy, e.g. "donations". */
  entityLabel: string;
  onClear?: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center space-y-3 px-4 py-10 text-center">
      <div className="space-y-1">
        <div className="text-muted-foreground">No matching {entityLabel}</div>
        <div className="text-sm text-muted-foreground">
          Try adjusting your search or filter criteria.
        </div>
      </div>
      {onClear && (
        <Button
          variant="outline"
          size="sm"
          onClick={onClear}
          className="cursor-pointer"
        >
          Clear filters
        </Button>
      )}
    </div>
  );
}

/**
 * Long-content table cell text: caps the column's width, keeps the text to
 * one truncated line, and carries the full value in a hover tooltip. Every
 * user-authored text column (names, titles, labels) should render through
 * this so no table ever side-scrolls because of one long value - detail
 * pages show the full text.
 */
export function CellText({
  children,
  className,
  text,
}: {
  /** Optional custom rendering; defaults to the text itself. */
  children?: ReactNode;
  /** Width cap + extras, e.g. "max-w-56". */
  className?: string;
  text: string;
}) {
  return (
    <span
      className={cn("block min-w-0 truncate", className ?? "max-w-56")}
      title={text}
    >
      {children ?? text}
    </span>
  );
}
