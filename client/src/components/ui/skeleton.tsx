import { cn } from "@/lib/utils";

export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("animate-pulse rounded-md bg-muted", className)} {...props} />;
}

export function TableRowsSkeleton({ cols = 4, rows = 6 }: { cols?: number; rows?: number }) {
  return (
    <div className="divide-y divide-border">
      {Array.from({ length: rows }).map((_, r) => (
        <div className="flex items-center gap-4 px-4 py-3.5" key={r}>
          {Array.from({ length: cols }).map((__, c) => (
            <Skeleton className={cn("h-4", c === 0 ? "w-40" : "w-24")} key={c} />
          ))}
        </div>
      ))}
    </div>
  );
}

export function CardGridSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton className="h-28 rounded-xl" key={i} />
      ))}
    </div>
  );
}
