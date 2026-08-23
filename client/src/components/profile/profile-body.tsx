"use client";

// The profile UI itself, shared by the console area and the voter portal so
// the page reads the same whichever chrome it opens inside.
//
// The column is capped rather than filling the console's content width. Every
// section inside already caps itself at max-w-md or max-w-lg, so in the 1152px
// console column the whole form hugged the left edge with roughly 640px of
// nothing beside it. This matches the voter portal's own width, which is what
// makes the two consistent.
import type { CurrentUser } from "@/types/api";

import { DetailsSection } from "@/components/profile/details-section";
import { SecuritySection } from "@/components/profile/security-section";
import { SessionsSection } from "@/components/profile/sessions-section";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

/** The width every profile surface shares. */
const PROFILE_COLUMN = "mx-auto w-full max-w-2xl";

export function ProfileBody({ user }: { user: CurrentUser }) {
  return (
    <div className={`${PROFILE_COLUMN} space-y-6`}>
      <div>
        <h1 className="text-xl font-semibold sm:text-2xl">My profile</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Your account details, security settings, and signed-in devices.
        </p>
      </div>
      <Tabs className="gap-6" defaultValue="details">
        <TabsList>
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
          <TabsTrigger value="sessions">Devices</TabsTrigger>
        </TabsList>
        <TabsContent value="details">
          <DetailsSection user={user} />
        </TabsContent>
        <TabsContent value="security">
          <SecuritySection user={user} />
        </TabsContent>
        <TabsContent value="sessions">
          <SessionsSection />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/** The same column, holding the shape the form settles into. */
export function ProfileBodySkeleton() {
  return (
    <div className={`${PROFILE_COLUMN} space-y-6`}>
      <div>
        <Skeleton className="h-6 w-36" />
        <Skeleton className="mt-2 h-3 w-72 max-w-full" />
      </div>
      <div className="flex gap-1">
        {["w-20", "w-20", "w-20"].map((width, i) => (
          <Skeleton className={`h-9 ${width}`} key={i} />
        ))}
      </div>
      <div className="space-y-5 border border-border bg-card p-6">
        <div className="flex items-center gap-4">
          <Skeleton className="size-16 shrink-0 rounded-full" />
          <div className="min-w-0 flex-1">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="mt-2 h-3 w-52 max-w-full" />
          </div>
        </div>
        <div className="grid max-w-lg gap-4 sm:grid-cols-2">
          {[0, 1, 2, 3].map((field) => (
            <div key={field}>
              <Skeleton className="h-3 w-24" />
              <Skeleton className="mt-2 h-9 w-full" />
            </div>
          ))}
        </div>
        <Skeleton className="h-9 w-32" />
      </div>
    </div>
  );
}
