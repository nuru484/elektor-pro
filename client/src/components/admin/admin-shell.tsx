"use client";

import {
  CheckSquare,
  LayoutDashboard,
  ListChecks,
  LogOut,
  Menu,
  ScrollText,
  Users,
  Vote,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useGetMeQuery, useLogoutMutation } from "@/redux/auth-api";
import type { Role } from "@/types/api";

const NAV: { href: string; icon: React.ComponentType<{ className?: string }>; label: string; roles?: Role[] }[] = [
  { href: "/admin", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/admin/elections", icon: Vote, label: "Elections" },
  { href: "/admin/approvals", icon: CheckSquare, label: "Approvals", roles: ["SUPER_ADMIN"] },
  { href: "/admin/candidates", icon: ListChecks, label: "Candidates" },
  { href: "/admin/voters", icon: Users, label: "Voters" },
  { href: "/admin/audit", icon: ScrollText, label: "Audit trail", roles: ["SUPER_ADMIN"] },
];

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { data, isError, isLoading } = useGetMeQuery();
  const [logout] = useLogoutMutation();
  const [open, setOpen] = useState(false);

  const user = data?.data;
  const isStaff = user && (user.role === "SUPER_ADMIN" || user.role === "ADMIN");

  useEffect(() => {
    if (!isLoading && (isError || (user && !isStaff))) router.replace("/login");
  }, [isError, isLoading, isStaff, router, user]);

  if (isLoading || !user || !isStaff) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <Skeleton className="h-24 w-64 rounded-xl" />
      </div>
    );
  }

  const items = NAV.filter((i) => !i.roles || i.roles.includes(user.role));

  const Sidebar = (
    <div className="flex h-full flex-col gap-1 p-3">
      <div className="px-2 py-3">
        <Logo href="/admin" />
      </div>
      <nav className="flex flex-1 flex-col gap-0.5">
        {items.map((item) => {
          const active = pathname === item.href || (item.href !== "/admin" && pathname.startsWith(item.href));
          return (
            <Link
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-brand-muted text-brand"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground",
              )}
              href={item.href}
              key={item.href}
              onClick={() => setOpen(false)}
            >
              <item.icon className="size-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-border pt-3">
        <div className="flex items-center gap-3 px-2 pb-2">
          <span className="flex size-8 items-center justify-center rounded-full bg-brand text-xs font-semibold text-brand-foreground">
            {user.firstName[0]}
            {user.lastName[0]}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">
              {user.firstName} {user.lastName}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {user.role.replace("_", " ").toLowerCase()}
            </p>
          </div>
        </div>
        <Button
          className="w-full justify-start"
          onClick={async () => {
            await logout();
            router.replace("/login");
          }}
          size="sm"
          variant="ghost"
        >
          <LogOut className="size-4" /> Sign out
        </Button>
      </div>
    </div>
  );

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[260px_1fr]">
      {/* Desktop sidebar */}
      <aside className="hidden border-r border-border bg-card lg:block">
        <div className="sticky top-0 h-dvh">{Sidebar}</div>
      </aside>

      {/* Mobile top bar */}
      <div className="flex items-center justify-between border-b border-border bg-card px-4 py-3 lg:hidden">
        <Logo href="/admin" />
        <Button onClick={() => setOpen(true)} size="icon" variant="ghost">
          <Menu className="size-5" />
        </Button>
      </div>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-foreground/30" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-0 h-full w-72 max-w-[85vw] border-r border-border bg-card">
            <div className="flex justify-end p-2">
              <Button onClick={() => setOpen(false)} size="icon" variant="ghost">
                <X className="size-5" />
              </Button>
            </div>
            {Sidebar}
          </div>
        </div>
      )}

      <main className="min-w-0 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <div className="mx-auto max-w-5xl">{children}</div>
      </main>
    </div>
  );
}
