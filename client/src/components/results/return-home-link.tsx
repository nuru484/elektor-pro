"use client";

// A direct, labelled way back to the viewer's own console from the public
// results/verify pages - browser-back should never be the only path. Shows
// nothing for anonymous visitors (they came from a shared link).
import { Home } from "lucide-react";
import Link from "next/link";

import { homeForRole } from "@/components/console/nav-config";
import { hasSessionMarker } from "@/lib/session-marker";
import { useGetMeQuery } from "@/redux/auth-api";

const LABELS: Record<string, string> = {
  ACCREDITOR: "Back to the accreditation desk",
  ADMIN: "Back to the console",
  AGENT: "Back to my assignments",
  CANDIDATE: "Back to my candidacies",
  SUPER_ADMIN: "Back to the console",
  VOTER: "Back to my elections",
};

export function ReturnHomeLink() {
  // Only ask "who am I" when this browser previously signed in.
  const marker = hasSessionMarker();
  const { data } = useGetMeQuery(undefined, { skip: !marker });
  const role = data?.data.role;
  if (!role) return null;

  return (
    <Link
      className="inline-flex items-center gap-1.5 text-sm font-medium text-brand hover:underline"
      href={homeForRole(role)}
      title="Return to your console"
    >
      <Home className="size-4" /> {LABELS[role] ?? "Back to my console"}
    </Link>
  );
}
