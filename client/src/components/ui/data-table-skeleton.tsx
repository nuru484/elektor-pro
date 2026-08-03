// src/components/ui/data-table-skeleton.tsx
import { TableRow, TableCell } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';

interface DataTableSkeletonProps {
  columnCount?: number;
  rowCount?: number;
  showFilters?: boolean;
  filterCount?: number;
  showActions?: boolean;
  showPagination?: boolean;
  showCheckbox?: boolean;
  showAvatar?: boolean;
  showMainContent?: boolean;
  showActionColumn?: boolean;
}

/**
 * A reusable skeleton component for data tables
 */
export function DataTableSkeleton({
  columnCount = 7,
  rowCount = 10,
  showFilters = false,
  filterCount = 2,
  showActions = false,
  showPagination = false,
  showCheckbox = true,
  showAvatar = false,
  showMainContent = true,
  showActionColumn = true,
}: DataTableSkeletonProps) {
  const tableRows = (
    <>
      {Array.from({ length: rowCount }).map((_, rowIndex) => (
        <TableRow key={`skeleton-row-${rowIndex}`}>
          {Array.from({ length: columnCount }).map((_, colIndex) => (
            <TableCell
              key={`cell-${rowIndex}-${colIndex}`}
              className="whitespace-nowrap"
            >
              {renderCellContent(
                colIndex,
                columnCount,
                showCheckbox,
                showAvatar,
                showMainContent,
                showActionColumn,
              )}
            </TableCell>
          ))}
        </TableRow>
      ))}
    </>
  );

  // Table element with proper overflow handling
  const tableElement = (
    <div className="rounded-md border overflow-hidden w-full max-w-full min-w-0">
      <div className="w-full max-w-full min-w-0 overflow-x-auto overscroll-x-contain">
        <table className="w-full min-w-max table-auto">
          <tbody>{tableRows}</tbody>
        </table>
      </div>
    </div>
  );

  // If filters or pagination are shown, wrap everything
  if (showFilters || showPagination) {
    return (
      <div className="w-full max-w-full min-w-0 space-y-6 overflow-x-hidden">
        {/* Filters Section */}
        {showFilters && (
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between min-w-0">
            <div className="flex flex-1 flex-col sm:flex-row gap-4 w-full min-w-0">
              {Array.from({ length: filterCount }).map((_, i) => (
                <Skeleton
                  key={`filter-${i}`}
                  className={`h-10 w-full min-w-0 ${
                    i === 0 ? 'sm:max-w-sm' : 'sm:w-45'
                  }`}
                />
              ))}
            </div>

            {showActions && (
              <div className="flex gap-2 flex-shrink-0">
                <Skeleton className="h-10 w-30" />
                <Skeleton className="h-10 w-35" />
              </div>
            )}
          </div>
        )}

        {/* Table with skeleton rows */}
        {tableElement}

        {/* Pagination */}
        {showPagination && (
          <div className="w-full max-w-full min-w-0 overflow-x-hidden">
            <div className="flex flex-wrap items-center justify-center lg:justify-between gap-3 px-4 sm:px-6 py-3 border-t bg-background min-w-0">
              {/* Stats Section */}
              <div className="flex flex-wrap items-center justify-center gap-3 min-w-0">
                <div className="flex items-center gap-2.5">
                  <Skeleton className="h-6 w-6 rounded-sm" />
                  <Skeleton className="h-4 w-30" />
                </div>
                <div className="flex items-center gap-2.5">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-8 w-15 rounded-md" />
                </div>
              </div>

              {/* Navigation Section */}
              <div className="flex flex-wrap items-center justify-center gap-3 min-w-0">
                <Skeleton className="h-4 w-35" />
                <div className="flex items-center gap-0.5">
                  <Skeleton className="h-8 w-8 rounded-r-none hidden md:block" />
                  <Skeleton className="h-8 w-8 rounded-none" />
                  <Skeleton className="h-4 w-15 mx-2 hidden lg:block" />
                  <Skeleton className="h-8 w-8 rounded-none" />
                  <Skeleton className="h-8 w-8 rounded-l-none hidden md:block" />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Bare rows for use inside <TableBody>
  return tableRows;
}

/**
 * Helper function to render cell content based on column position and type
 */
function renderCellContent(
  colIndex: number,
  columnCount: number,
  showCheckbox: boolean,
  showAvatar: boolean,
  showMainContent: boolean,
  showActionColumn: boolean,
) {
  // First column - Checkbox
  if (colIndex === 0 && showCheckbox) {
    return <Skeleton className="h-4 w-4 rounded" />;
  }

  // Adjust index if checkbox is hidden
  const adjustedIndex = showCheckbox ? colIndex : colIndex + 1;

  // Second column (usually) - Avatar
  if (adjustedIndex === 1 && showAvatar) {
    return <Skeleton className="h-10 w-10 rounded-full" />;
  }

  // Third column (usually) - Main content with title + subtitle
  if (adjustedIndex === 2 && showMainContent) {
    return (
      <div className="space-y-2 min-w-0">
        <Skeleton className="h-4 w-full max-w-[180px]" />
        <Skeleton className="h-3 w-2/3 max-w-[120px]" />
      </div>
    );
  }

  // Last column - Actions
  if (colIndex === columnCount - 1 && showActionColumn) {
    return (
      <div className="flex justify-end">
        <Skeleton className="h-8 w-8 rounded-md" />
      </div>
    );
  }

  // Middle columns - Various widths for realism
  const widths = ['w-16', 'w-24', 'w-20', 'w-28', 'w-32'];
  const widthClass = widths[colIndex % widths.length];

  // Randomly make some columns look like badges
  if ((adjustedIndex + 1) % 4 === 0) {
    return <Skeleton className={`h-6 ${widthClass} rounded-full opacity-80`} />;
  }

  // Randomly make some columns look like currency/numbers (right-aligned maybe?)
  if ((adjustedIndex + 1) % 5 === 0) {
    return (
      <div className="flex justify-end">
        <Skeleton className={`h-4 ${widthClass}`} />
      </div>
    );
  }

  return <Skeleton className={`h-4 ${widthClass}`} />;
}
