"use client";

// The voter's profile, INSIDE the voter portal chrome (no console sidebar).
// The body is the same component the console area renders, so both read
// identically.
import { useRouter } from "next/navigation";
import { useEffect } from "react";

import {
  ProfileBody,
  ProfileBodySkeleton,
} from "@/components/profile/profile-body";
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
        <ProfileBodySkeleton />
      ) : (
        <ProfileBody user={user} />
      )}
    </VoterChrome>
  );
}
