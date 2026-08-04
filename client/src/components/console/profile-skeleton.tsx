"use client";

// Content-shaped loading state for the profile detail pages: the identity
// rail (avatar, name, facts) beside the detail cards - mirrors the real
// layout instead of a generic block.
import { Skeleton } from "@/components/ui/skeleton";

export function ProfileSkeleton() {
  return (
    <div className="gap-6 space-y-6 max-sm:space-y-8 lg:grid lg:grid-cols-[300px_1fr] lg:items-start lg:space-y-0">
      <div className="flex flex-col items-center gap-3 rounded-xl border border-border bg-card p-6">
        <Skeleton className="size-20 rounded-full" />
        <Skeleton className="h-5 w-36" />
        <div className="w-full space-y-2.5 border-t border-border pt-4">
          {[0, 1, 2].map((row) => (
            <div className="flex justify-between" key={row}>
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-3 w-24" />
            </div>
          ))}
        </div>
      </div>
      <div className="space-y-6">
        {[0, 1].map((card) => (
          <div className="space-y-4 rounded-xl border border-border bg-card p-6" key={card}>
            <Skeleton className="h-4 w-28" />
            <div className="grid gap-4 sm:grid-cols-2">
              {[0, 1, 2, 3].map((cell) => (
                <div className="space-y-1.5" key={cell}>
                  <Skeleton className="h-3 w-16" />
                  <Skeleton className="h-4 w-32" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
