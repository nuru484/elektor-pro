// src/components/console/nav-config.ts
//
// Single source of truth for console navigation. Every entry declares which
// roles see it; the shell filters by the signed-in user's role. UI-only -
// the backend enforces the real authorization on every endpoint.
import {
  CheckSquare,
  LayoutDashboard,
  ListChecks,
  ScrollText,
  UserCircle,
  Users,
  Vote,
} from "lucide-react";

import type { Role } from "@/types/api";

export interface NavItem {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  roles: Role[];
}

export interface NavSection {
  items: NavItem[];
  label?: string;
}

const STAFF: Role[] = ["SUPER_ADMIN", "ADMIN"];
const ALL: Role[] = ["SUPER_ADMIN", "ADMIN", "AGENT", "CANDIDATE", "ACCREDITOR", "VOTER"];

export const NAV_SECTIONS: NavSection[] = [
  {
    items: [
      { href: "/admin", icon: LayoutDashboard, label: "Dashboard", roles: STAFF },
      { href: "/admin/elections", icon: Vote, label: "Elections", roles: STAFF },
      {
        href: "/admin/approvals",
        icon: CheckSquare,
        label: "Approvals",
        roles: ["SUPER_ADMIN"],
      },
      { href: "/admin/candidates", icon: ListChecks, label: "Candidates", roles: STAFF },
      { href: "/admin/voters", icon: Users, label: "Voters", roles: STAFF },
      {
        href: "/admin/audit",
        icon: ScrollText,
        label: "Audit trail",
        roles: ["SUPER_ADMIN"],
      },
    ],
    label: "Manage",
  },
  {
    items: [
      { href: "/vote", icon: Vote, label: "My elections", roles: ["VOTER"] },
      { href: "/profile", icon: UserCircle, label: "My profile", roles: ALL },
    ],
    label: "Account",
  },
];

/** Sections visible to a role, with empty sections dropped. */
export const sectionsForRole = (role: Role): NavSection[] =>
  NAV_SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter((item) => item.roles.includes(role)),
  })).filter((section) => section.items.length > 0);

/** Where a role lands after signing in. */
export const homeForRole = (role: Role): string => {
  if (role === "SUPER_ADMIN" || role === "ADMIN") return "/admin";
  if (role === "VOTER") return "/vote";
  return "/profile";
};
