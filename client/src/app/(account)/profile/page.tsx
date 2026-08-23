"use client";

// The profile for every console role - candidate, agent, accreditor and staff
// alike. The page supplies the guard; ProfileBody supplies the UI, shared with
// the voter portal's copy.
import { ProfileBody } from "@/components/profile/profile-body";
import { useAuthRole } from "@/hooks/use-auth-role";

export default function ProfilePage() {
  const { user } = useAuthRole();
  if (!user) return null; // the shell guard handles redirects

  return <ProfileBody user={user} />;
}
