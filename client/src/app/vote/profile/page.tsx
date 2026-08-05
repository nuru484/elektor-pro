"use client";

// The voter's profile, INSIDE the voter portal chrome: same light layout as
// the elections view (no admin sidebar). Reuses the shared profile sections.
import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { DetailsSection } from "@/components/profile/details-section";
import { SecuritySection } from "@/components/profile/security-section";
import { SessionsSection } from "@/components/profile/sessions-section";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { VoterChrome } from "@/components/vote/voter-header";
import { useGetMeQuery } from "@/redux/auth-api";

export default function VoterProfilePage() {
  const router = useRouter();
  const { data, isError, isLoading } = useGetMeQuery();
  const user = data?.data;

  // No session: back to the voter sign-in.
  useEffect(() => {
    if (isError) router.replace("/vote");
  }, [isError, router]);

  return (
    <VoterChrome>
      {isLoading || !user ? (
        <div className="space-y-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-64 w-full rounded-xl" />
        </div>
      ) : (
        <div className="space-y-6">
          <div>
            <h1 className="text-xl font-semibold">My profile</h1>
            <p className="text-sm text-muted-foreground">
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
      )}
    </VoterChrome>
  );
}
