// Content-shaped loading states for the console.
//
// Each of these mirrors the component it stands in for - the same grid, the
// same number of cells, the same line lengths in the same places - so the page
// does not visibly reflow when the data lands. A generic block sized to a
// guess moves everything under it the moment it is replaced, which reads as a
// second load.
//
// The rule for line widths: match what the real content settles at, not the
// full column. A value that renders as "1,284" should not be stood in for by a
// bar the width of the card.
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/** One StatCard: mono label, oversized value, optional hint, trailing icon. */
export function StatCardSkeleton({ hint = true }: { hint?: boolean }) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <Skeleton className="h-2.5 w-20" />
            <Skeleton className="mt-2.5 h-7 w-16" />
            {hint && <Skeleton className="mt-2 h-2.5 w-28" />}
          </div>
          <Skeleton className="size-5 shrink-0" />
        </div>
      </CardContent>
    </Card>
  );
}

/** A row of stat cards. `cols` matches the grid the real cards sit in. */
export function StatGridSkeleton({
  cols = 3,
  count = 3,
  hint = true,
}: {
  cols?: 2 | 3 | 4;
  count?: number;
  hint?: boolean;
}) {
  return (
    <div
      className={cn(
        "grid grid-cols-1 gap-4 min-[420px]:grid-cols-2",
        cols === 3 && "lg:grid-cols-3",
        cols === 4 && "lg:grid-cols-4",
      )}
    >
      {Array.from({ length: count }).map((_, i) => (
        <StatCardSkeleton hint={hint} key={i} />
      ))}
    </div>
  );
}

/** The dashboard work queue: icon, count, label, five across. */
function WorkQueueSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
      {Array.from({ length: 5 }).map((_, i) => (
        <div className="border border-border bg-card p-4" key={i}>
          <Skeleton className="size-4" />
          <Skeleton className="mt-2 h-5 w-8" />
          <Skeleton className="mt-1.5 h-2.5 w-24" />
        </div>
      ))}
    </div>
  );
}

/** A titled card with a body of the caller's shape. */
export function SectionCardSkeleton({
  children,
  titleWidth = "w-32",
}: {
  children: React.ReactNode;
  titleWidth?: string;
}) {
  return (
    <Card className="h-full">
      <CardContent className="flex h-full flex-col p-5">
        <Skeleton className={cn("mb-4 h-4", titleWidth)} />
        <div className="min-h-0 flex-1">{children}</div>
      </CardContent>
    </Card>
  );
}

/**
 * The daily-bars chart. Heights are a fixed pattern rather than random so the
 * skeleton renders identically on the server and the client, and so it does
 * not shimmer into a different silhouette on every paint.
 */
const BAR_HEIGHTS = [
  38, 62, 45, 78, 55, 88, 42, 70, 58, 95, 48, 66, 52, 82,
];

function ChartSkeleton() {
  return (
    <div className="flex min-h-40 flex-col justify-end">
      <div className="flex h-40 items-end gap-1.5">
        {BAR_HEIGHTS.map((height, i) => (
          <Skeleton
            className="min-w-0 flex-1"
            key={i}
            style={{ height: `${height}%` }}
          />
        ))}
      </div>
      <div className="mt-3 flex justify-between">
        <Skeleton className="h-2.5 w-10" />
        <Skeleton className="h-2.5 w-10" />
      </div>
    </div>
  );
}

/** MeterList: label and figure on one line, the bar under it. */
export function MeterListSkeleton({ rows = 4 }: { rows?: number }) {
  const widths = ["w-32", "w-40", "w-24", "w-36", "w-28"];
  return (
    <div className="space-y-4">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i}>
          <div className="flex items-baseline justify-between gap-3">
            <Skeleton className={cn("h-3.5", widths[i % widths.length])} />
            <Skeleton className="h-2.5 w-14 shrink-0" />
          </div>
          <Skeleton className="mt-1.5 h-1.5 w-full" />
        </div>
      ))}
    </div>
  );
}

/** A list of linked rows: name on the left, status badge on the right. */
function LinkedRowsSkeleton({ rows = 5 }: { rows?: number }) {
  const widths = ["w-44", "w-32", "w-52", "w-36", "w-40"];
  return (
    <div className="divide-y divide-border">
      {Array.from({ length: rows }).map((_, i) => (
        <div className="flex items-center justify-between gap-3 py-3" key={i}>
          <Skeleton className={cn("h-3.5", widths[i % widths.length])} />
          <Skeleton className="h-5 w-16 shrink-0 rounded-full" />
        </div>
      ))}
    </div>
  );
}

/** The whole admin dashboard, in its real layout. */
export function DashboardSkeleton() {
  return (
    <div className="space-y-8">
      <StatGridSkeleton count={6} />
      <WorkQueueSkeleton />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <SectionCardSkeleton titleWidth="w-40">
            <ChartSkeleton />
          </SectionCardSkeleton>
        </div>
        <SectionCardSkeleton titleWidth="w-36">
          <MeterListSkeleton rows={4} />
        </SectionCardSkeleton>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <SectionCardSkeleton titleWidth="w-20">
          <MeterListSkeleton rows={3} />
        </SectionCardSkeleton>
        <SectionCardSkeleton titleWidth="w-36">
          <LinkedRowsSkeleton rows={5} />
        </SectionCardSkeleton>
        <SectionCardSkeleton titleWidth="w-32">
          <LinkedRowsSkeleton rows={5} />
        </SectionCardSkeleton>
      </div>
    </div>
  );
}

/**
 * Cards keyed by a person: avatar, name, contact line, then whatever the row
 * is about. Used by the accreditor and agent assignment lists.
 */
export function EntityCardsSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {Array.from({ length: count }).map((_, i) => (
        <Card key={i}>
          <CardContent className="flex items-start justify-between gap-3 p-4">
            <div className="flex min-w-0 flex-1 items-start gap-3">
              <Skeleton className="size-9 shrink-0 rounded-full" />
              <div className="min-w-0 flex-1">
                <Skeleton className="h-3.5 w-32" />
                <Skeleton className="mt-1.5 h-2.5 w-40" />
                <div className="mt-2.5 flex items-center gap-2">
                  <Skeleton className="h-3.5 w-28" />
                  <Skeleton className="h-5 w-16 rounded-full" />
                </div>
                <Skeleton className="mt-2 h-2.5 w-36" />
              </div>
            </div>
            <Skeleton className="size-8 shrink-0" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

/**
 * Stacked settings cards: title, description, then labelled fields two across.
 * `fields` is per card, so the skeleton is as tall as the form it replaces.
 */
export function SettingsCardsSkeleton({
  cards = 3,
  fields = 2,
}: {
  cards?: number;
  fields?: number;
}) {
  return (
    <div className="space-y-6">
      {Array.from({ length: cards }).map((_, card) => (
        <Card key={card}>
          <CardContent className="space-y-5 p-6">
            <div>
              <Skeleton className="h-4 w-28" />
              <Skeleton className="mt-2 h-3 w-72 max-w-full" />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {Array.from({ length: fields }).map((__, field) => (
                <div key={field}>
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="mt-2 h-9 w-full" />
                </div>
              ))}
            </div>
            <Skeleton className="h-9 w-28" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

/** A single bordered panel with a heading and a few lines of prose. */
export function InfoPanelSkeleton({ lines = 3 }: { lines?: number }) {
  const widths = ["w-full", "w-11/12", "w-4/5", "w-2/3"];
  return (
    <div className="border border-border bg-card p-5">
      <div className="flex items-center gap-2">
        <Skeleton className="size-4" />
        <Skeleton className="h-3.5 w-28" />
      </div>
      <div className="mt-3 space-y-2">
        {Array.from({ length: lines }).map((_, i) => (
          <Skeleton className={cn("h-3", widths[i % widths.length])} key={i} />
        ))}
      </div>
    </div>
  );
}

/** The election workspace overview: the stat row plus its two info panels. */
export function ElectionOverviewSkeleton() {
  return (
    <div className="space-y-4">
      <StatGridSkeleton count={3} />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <InfoPanelSkeleton lines={3} />
        <InfoPanelSkeleton lines={4} />
      </div>
    </div>
  );
}

/**
 * A bordered list of divided rows - the shape the vetting criteria, the
 * vetting queue and the candidate picker all render into.
 */
export function BorderedListSkeleton({
  avatar = false,
  rows = 3,
}: {
  avatar?: boolean;
  rows?: number;
}) {
  const widths = ["w-40", "w-52", "w-32", "w-44"];
  return (
    <div className="divide-y divide-border border border-border">
      {Array.from({ length: rows }).map((_, i) => (
        <div className="flex items-center gap-3 px-3 py-2.5" key={i}>
          {avatar && <Skeleton className="size-8 shrink-0 rounded-full" />}
          <div className="min-w-0 flex-1">
            <Skeleton className={cn("h-3.5", widths[i % widths.length])} />
            <Skeleton className="mt-1.5 h-2.5 w-24" />
          </div>
          <Skeleton className="h-5 w-14 shrink-0" />
        </div>
      ))}
    </div>
  );
}

/**
 * The permissions matrix: a capability column, one column per editable role,
 * and the checkbox grid between them, grouped under section headers.
 */
export function PermissionsMatrixSkeleton({
  groups = 3,
  roles = 4,
  rowsPerGroup = 4,
}: {
  groups?: number;
  roles?: number;
  rowsPerGroup?: number;
}) {
  return (
    <div className="overflow-x-auto border border-border">
      <div className="min-w-[600px]">
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-border bg-muted/40 px-4 py-3">
          <Skeleton className="h-3.5 w-24 flex-1" />
          {Array.from({ length: roles }).map((_, i) => (
            <Skeleton className="h-3.5 w-16 shrink-0" key={i} />
          ))}
        </div>

        {Array.from({ length: groups }).map((_, group) => (
          <div key={group}>
            <div className="border-b border-border bg-muted/20 px-4 py-2">
              <Skeleton className="h-2.5 w-28" />
            </div>
            {Array.from({ length: rowsPerGroup }).map((__, row) => (
              <div
                className="flex items-center gap-3 border-b border-border px-4 py-3 last:border-b-0"
                key={row}
              >
                <Skeleton className="h-3.5 w-48 flex-1" />
                {Array.from({ length: roles }).map((___, cell) => (
                  <span className="flex w-16 shrink-0 justify-center" key={cell}>
                    <Skeleton className="size-4" />
                  </span>
                ))}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * The vetting workspace before the election loads: the ballot-number toolbar,
 * the criteria panel and the candidate queue it splits into.
 */
export function VettingBoardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Skeleton className="h-4 w-40" />
          <Skeleton className="mt-2 h-2.5 w-64 max-w-full" />
        </div>
        <Skeleton className="h-9 w-36" />
      </div>
      <div>
        <Skeleton className="h-3.5 w-32" />
        <div className="mt-3">
          <BorderedListSkeleton rows={2} />
        </div>
      </div>
      <div>
        <Skeleton className="h-3.5 w-28" />
        <div className="mt-3">
          <BorderedListSkeleton avatar rows={4} />
        </div>
      </div>
    </div>
  );
}

/**
 * A card headed by a title and a status badge, with an avatar row and a
 * progress line under it - the shape the candidacy and assignment cards take.
 */
export function RecordCardsSkeleton({
  count = 3,
  cols = 3,
}: {
  cols?: 1 | 2 | 3;
  count?: number;
}) {
  return (
    <div
      className={cn(
        "grid gap-4",
        cols >= 2 && "sm:grid-cols-2",
        cols === 3 && "lg:grid-cols-3",
      )}
    >
      {Array.from({ length: count }).map((_, i) => (
        <Card key={i}>
          <CardContent className="space-y-3 p-6">
            <div className="flex items-start justify-between gap-3">
              <Skeleton className="h-4 w-36" />
              <Skeleton className="h-5 w-16 shrink-0 rounded-full" />
            </div>
            <div className="flex items-center gap-2.5 pt-1">
              <Skeleton className="size-10 shrink-0 rounded-full" />
              <div className="min-w-0 flex-1">
                <Skeleton className="h-3.5 w-28" />
                <Skeleton className="mt-1.5 h-2.5 w-36" />
              </div>
            </div>
            <div>
              <Skeleton className="h-2.5 w-24" />
              <Skeleton className="mt-1.5 h-1.5 w-full" />
            </div>
            <Skeleton className="h-8 w-full" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

/** A three-up figure strip: caption over value, as the live turnout box reads. */
export function FigureStripSkeleton({ cells = 3 }: { cells?: number }) {
  return (
    <div className="grid grid-cols-3 gap-1 border border-border bg-muted/30 px-2 py-2">
      {Array.from({ length: cells }).map((_, i) => (
        <div className="flex flex-col items-center gap-1.5" key={i}>
          <Skeleton className="h-2 w-14" />
          <Skeleton className="h-3.5 w-10" />
        </div>
      ))}
    </div>
  );
}

/** Scored rows against a total - the candidate's own vetting breakdown. */
export function ScoreBreakdownSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <div className="flex items-center justify-between gap-3" key={i}>
          <Skeleton className="h-3 w-32" />
          <Skeleton className="h-3 w-12 shrink-0" />
        </div>
      ))}
      <div className="flex items-center justify-between gap-3 border-t border-border pt-2">
        <Skeleton className="h-3.5 w-20" />
        <Skeleton className="h-3.5 w-16 shrink-0" />
      </div>
    </div>
  );
}
