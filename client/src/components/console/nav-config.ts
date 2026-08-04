// src/components/console/nav-config.ts
//
// Single source of truth for console navigation. Every entry declares which
// roles see it; the shell filters by the signed-in user's role. UI-only -
// the backend enforces the real authorization on every endpoint.
import {
  ArchiveRestore,
  Building2,
  CheckSquare,
  Eye,
  FolderTree,
  KeySquare,
  LayoutDashboard,
  ListChecks,
  ScrollText,
  ShieldCheck,
  UserCheck,
  UserCircle,
  UserCog,
  Users,
  Vote,
} from "lucide-react";

import type { Capability, Role } from "@/types/api";

export interface NavItem {
  /** Also visible to anyone holding this capability, regardless of role. */
  capability?: Capability;
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
        capability: "APPROVE_CHANGES",
        href: "/admin/approvals",
        icon: CheckSquare,
        label: "Approvals",
        roles: ["SUPER_ADMIN"],
      },
      { href: "/admin/candidates", icon: ListChecks, label: "Candidates", roles: STAFF },
      { href: "/admin/voters", icon: Users, label: "Voters", roles: STAFF },
      { href: "/admin/groups", icon: FolderTree, label: "Groups", roles: STAFF },
      {
        capability: "MANAGE_AGENTS",
        href: "/admin/agents",
        icon: UserCheck,
        label: "Agents",
        roles: STAFF,
      },
      { href: "/admin/users", icon: UserCog, label: "Users", roles: STAFF },
    ],
    label: "Manage",
  },
  {
    items: [
      {
        capability: "MANAGE_ORGANIZATION",
        href: "/admin/organization",
        icon: Building2,
        label: "Organization",
        roles: ["SUPER_ADMIN"],
      },
      {
        href: "/admin/permissions",
        icon: ShieldCheck,
        label: "Permissions",
        roles: ["SUPER_ADMIN"],
      },
      {
        href: "/admin/grants",
        icon: KeySquare,
        label: "Access grants",
        roles: ["SUPER_ADMIN"],
      },
      {
        href: "/admin/audit",
        icon: ScrollText,
        label: "Audit trail",
        roles: ["SUPER_ADMIN"],
      },
      {
        href: "/admin/deleted",
        icon: ArchiveRestore,
        label: "Deleted records",
        roles: ["SUPER_ADMIN"],
      },
    ],
    label: "Governance",
  },
  {
    items: [
      { href: "/agent", icon: Eye, label: "My assignments", roles: ["AGENT"] },
      { href: "/vote", icon: Vote, label: "My elections", roles: ["VOTER"] },
      { href: "/profile", icon: UserCircle, label: "My profile", roles: ALL },
    ],
    label: "Account",
  },
];

/** Sections visible to a role (or capability holder), empty sections dropped. */
export const sectionsForRole = (
  role: Role,
  capabilities: Capability[] = [],
): NavSection[] =>
  NAV_SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter(
      (item) =>
        item.roles.includes(role) ||
        (item.capability !== undefined && capabilities.includes(item.capability)),
    ),
  })).filter((section) => section.items.length > 0);

/** Where a role lands after signing in. */
export const homeForRole = (role: Role): string => {
  if (role === "SUPER_ADMIN" || role === "ADMIN") return "/admin";
  if (role === "AGENT") return "/agent";
  if (role === "VOTER") return "/vote";
  return "/profile";
};
