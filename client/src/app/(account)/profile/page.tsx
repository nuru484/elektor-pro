"use client";

import { DetailsSection } from "@/components/profile/details-section";
import { SecuritySection } from "@/components/profile/security-section";
import { SessionsSection } from "@/components/profile/sessions-section";
import { PageHeader } from "@/components/ui/states";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuthRole } from "@/hooks/use-auth-role";

export default function ProfilePage() {
  const { user } = useAuthRole();
  if (!user) return null; // the shell guard handles redirects

  return (
    <div className="space-y-6">
      <PageHeader
        description="Your account details, security settings, and signed-in devices."
        title="My profile"
      />
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
