"use client";

// The console shell: a persistent sidebar on large screens, a sheet drawer on
// phones, and a slim top bar with the theme toggle + account menu. Role-aware:
// nav items come from nav-config filtered by the signed-in user's role, and
// the guard redirects signed-out visitors to the right login page.
import { LogOut, Menu, ShieldCheck, UserCircle } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import type { Role } from "@/types/api";

import { Logo } from "@/components/brand/logo";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuthRole } from "@/hooks/use-auth-role";
import { cn } from "@/lib/utils";
import { useGetMeQuery, useLogoutMutation } from "@/redux/auth-api";

import { sectionsForRole } from "./nav-config";

const ROLE_LABELS: Record<Role, string> = {
  ACCREDITOR: "Accreditor",
  ADMIN: "Administrator",
  AGENT: "Agent",
  CANDIDATE: "Candidate",
  SUPER_ADMIN: "Super administrator",
  VOTER: "Voter",
};

function NavList({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { role } = useAuthRole();
  if (!role) return null;

  return (
    <nav aria-label="Console" className="flex flex-1 flex-col gap-5 overflow-y-auto px-3 py-4">
      {sectionsForRole(role).map((section) => (
        <div key={section.label ?? "main"}>
          {section.label && (
            <p className="mb-1.5 px-3 text-[11px] font-medium tracking-[0.08em] text-muted-foreground/70 uppercase">
              {section.label}
            </p>
          )}
          <div className="flex flex-col gap-0.5">
            {section.items.map((item) => {
              const active =
                pathname === item.href ||
                (item.href !== "/admin" && pathname.startsWith(`${item.href}/`));
              return (
                <Link
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                    active
                      ? "bg-brand-muted text-brand"
                      : "text-muted-foreground hover:bg-accent hover:text-foreground",
                  )}
                  href={item.href}
                  key={item.href}
                  onClick={onNavigate}
                >
                  <item.icon className="size-4 shrink-0" />
                  {item.label}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}

function UserMenu() {
  const router = useRouter();
  const { role, user } = useAuthRole();
  const [logout] = useLogoutMutation();
  if (!user || !role) return null;

  const initials = `${user.firstName[0] ?? ""}${user.lastName[0] ?? ""}`.toUpperCase();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          aria-label="Account menu"
          className="flex size-8 items-center justify-center overflow-hidden rounded-full bg-brand text-xs font-semibold text-brand-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
          type="button"
        >
          {user.profilePicture ? (
            // eslint-disable-next-line @next/next/no-img-element -- avatar from Cloudinary, tiny
            <img alt="" className="size-full object-cover" src={user.profilePicture} />
          ) : (
            initials
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>
          <p className="truncate text-sm font-medium">
            {user.firstName} {user.lastName}
          </p>
          <p className="truncate text-xs font-normal text-muted-foreground">
            {ROLE_LABELS[role]}
          </p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/profile">
            <UserCircle className="size-4" /> My profile
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={async () => {
            await logout();
            router.replace("/login");
          }}
          variant="destructive"
        >
          <LogOut className="size-4" /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function ConsoleShell({
  allowedRoles,
  children,
}: {
  /** Roles allowed into this area; anyone else is sent to their home. */
  allowedRoles?: Role[];
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { isError, isLoading } = useGetMeQuery();
  const { initialized, role, user } = useAuthRole();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const allowed = Boolean(role && (!allowedRoles || allowedRoles.includes(role)));

  useEffect(() => {
    if (isLoading) return;
    if (isError || (initialized && !user)) {
      router.replace("/login");
      return;
    }
    if (role && !allowed) {
      router.replace("/profile");
    }
  }, [allowed, initialized, isError, isLoading, role, router, user]);

  if (isLoading || !user || !allowed) {
    return (
      <div className="flex min-h-dvh flex-col gap-4 bg-background p-6 lg:grid lg:grid-cols-[264px_1fr] lg:gap-0 lg:p-0">
        <Skeleton className="hidden h-dvh lg:block" />
        <div className="space-y-4 lg:p-8">
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-40 w-full rounded-xl" />
          <Skeleton className="h-40 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-sidebar-border px-5 py-4">
        <Logo href="/" />
      </div>
      <NavList onNavigate={() => setDrawerOpen(false)} />
      <div className="border-t border-sidebar-border p-3">
        <p className="flex items-center gap-2 px-2 text-[11px] text-muted-foreground">
          <ShieldCheck className="size-3.5 text-brand" />
          Secured, audited elections
        </p>
      </div>
    </div>
  );

  return (
    <div className="min-h-dvh bg-background lg:grid lg:grid-cols-[264px_1fr]">
      {/* Desktop sidebar */}
      <aside className="hidden border-r border-sidebar-border bg-sidebar lg:block">
        <div className="sticky top-0 h-dvh">{sidebar}</div>
      </aside>

      <div className="flex min-w-0 flex-col">
        {/* Top bar */}
        <header className="sticky top-0 z-40 flex items-center justify-between gap-3 border-b border-border bg-background/95 px-4 py-2.5 backdrop-blur sm:px-6">
          <div className="flex items-center gap-2">
            <Sheet onOpenChange={setDrawerOpen} open={drawerOpen}>
              <SheetTrigger asChild>
                <Button aria-label="Open navigation" className="lg:hidden" size="icon-sm" variant="ghost">
                  <Menu className="size-5" />
                </Button>
              </SheetTrigger>
              <SheetContent className="w-72 bg-sidebar p-0" side="left">
                <SheetTitle className="sr-only">Navigation</SheetTitle>
                {sidebar}
              </SheetContent>
            </Sheet>
            <span className="lg:hidden">
              <Logo href="/" />
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <ThemeToggle />
            <UserMenu />
          </div>
        </header>

        <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <div className="mx-auto w-full max-w-6xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
