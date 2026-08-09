"use client";

// The console shell: a persistent sidebar on large screens (collapsible to an
// icon rail, DMS-style), a sheet drawer on phones, a slim top bar whose
// bottom hairline lines up with the sidebar header's, and a console footer.
// Role-aware: nav items come from nav-config filtered by the signed-in user's
// role, and the guard redirects signed-out visitors to the login page.
import {
  ArrowLeft,
  LogOut,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  UserCircle,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";

import type { Role } from "@/types/api";

import type { NavItem } from "./nav-config";

import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LoadingScreen } from "@/components/ui/loading-screen";
import { ThemeToggle } from "@/components/theme-toggle";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useAuthRole } from "@/hooks/use-auth-role";
import { clearSessionMarker, setSessionMarker } from "@/lib/session-marker";
import { cn } from "@/lib/utils";
import { useGetMeQuery, useLogoutMutation } from "@/redux/auth-api";

import { homeForRole, sectionsForRole } from "./nav-config";

const COLLAPSE_KEY = "ep-sidebar-collapsed";

const emptySubscribe = () => () => {
  // localStorage only changes through this component in this tab.
};

/**
 * Back affordance in the top bar: on any /admin subpage (details, creation
 * pages) it links to that section's list, so pages don't stack their own
 * back link above the heading.
 */
function HeaderBackButton() {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);
  if (segments[0] !== "admin" || segments.length < 3) return null;
  return (
    <Button asChild aria-label="Back" size="icon-sm" variant="ghost">
      <Link href={`/admin/${segments[1]}`}>
        <ArrowLeft className="size-5" />
      </Link>
    </Button>
  );
}

const ROLE_LABELS: Record<Role, string> = {
  ACCREDITOR: "Accreditor",
  ADMIN: "Administrator",
  AGENT: "Agent",
  CANDIDATE: "Candidate",
  SUPER_ADMIN: "Super administrator",
  VOTER: "Voter",
};

function NavList({
  collapsed = false,
  onNavigate,
}: {
  collapsed?: boolean;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const { role, user } = useAuthRole();
  if (!role) return null;

  return (
    <nav
      aria-label="Console"
      className={cn("flex flex-1 flex-col gap-5 overflow-y-auto py-4", collapsed ? "px-2" : "px-3")}
    >
      {sectionsForRole(role, user?.capabilities ?? []).map((section) => (
        <div key={section.label ?? "main"}>
          {section.label && !collapsed && (
            <p className="mb-1.5 px-3 text-[11px] font-medium tracking-[0.08em] text-muted-foreground/70 uppercase">
              {section.label}
            </p>
          )}
          <div className="flex flex-col gap-0.5">
            {section.items.map((item) => {
              const active =
                pathname === item.href ||
                (item.href !== "/admin" && pathname.startsWith(`${item.href}/`));
              const link = (
                <Link
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-3 rounded-lg text-sm font-medium transition-colors",
                    collapsed ? "justify-center px-0 py-2.5" : "px-3 py-2",
                    active
                      ? "bg-brand-muted text-brand"
                      : "text-muted-foreground hover:bg-accent hover:text-foreground",
                  )}
                  href={item.href}
                  onClick={onNavigate}
                >
                  <item.icon className="size-4 shrink-0" />
                  {!collapsed && item.label}
                </Link>
              );
              return collapsed ? (
                <Tooltip key={item.href}>
                  <TooltipTrigger asChild>{link}</TooltipTrigger>
                  <TooltipContent side="right">{item.label}</TooltipContent>
                </Tooltip>
              ) : (
                <span key={item.href}>{link}</span>
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
  const [confirmOpen, setConfirmOpen] = useState(false);
  if (!user || !role) return null;

  const initials = `${user.firstName[0] ?? ""}${user.lastName[0] ?? ""}`.toUpperCase();

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            aria-label="Account menu"
            className="flex size-8 items-center justify-center overflow-hidden rounded-full bg-brand text-xs font-semibold text-brand-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
            type="button"
          >
            {user.profilePicture ? (
              // Optimised rather than served as a full-size Cloudinary
              // original; `fill` because the button above fixes the box.
              <span className="relative size-full">
                <Image
                  alt=""
                  className="object-cover"
                  fill
                  sizes="32px"
                  src={user.profilePicture}
                />
              </span>
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
          <DropdownMenuItem onClick={() => setConfirmOpen(true)} variant="destructive">
            <LogOut className="size-4" /> Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ConfirmationDialog
        confirmText="Sign out"
        description="You will be signed out of this device."
        isDestructive
        onConfirm={async () => {
          setConfirmOpen(false);
          await logout();
          clearSessionMarker();
          router.replace("/login");
        }}
        onOpenChange={setConfirmOpen}
        open={confirmOpen}
        title="Sign out?"
      />
    </>
  );
}

/** One link in the top-bar console nav. */
function TopNavLink({ item }: { item: NavItem }) {
  const pathname = usePathname();
  const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
  return (
    <Link
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
        active
          ? "bg-accent text-foreground"
          : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
      )}
      href={item.href}
    >
      <item.icon className="size-4" />
      {item.label}
    </Link>
  );
}

function ConsoleFooter() {
  return (
    <footer className="border-t border-border bg-background/95">
      <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-2 px-4 py-4 text-center sm:px-6 lg:flex-row lg:px-8 lg:text-left">
        <div className="flex items-center gap-2">
          <Logo href={null} showText={false} />
          <span className="text-xs font-semibold">Elektor Pro</span>
        </div>
        <p className="text-[11px] text-muted-foreground">
          {/* Each half is an unbreakable chunk: one line where both fit, the
              credit drops down whole where they don't. */}
          <span className="inline-block whitespace-nowrap">
            © {new Date().getFullYear()} Elektor Pro. All rights reserved.
          </span>{" "}
          <span className="inline-block whitespace-nowrap">
            Developed by{" "}
            <a
              className="font-semibold text-foreground transition-colors hover:text-brand"
              href="https://manuru.dev"
              rel="noopener noreferrer"
              target="_blank"
            >
              manuru
            </a>
          </span>
        </p>
      </div>
    </footer>
  );
}

export function ConsoleShell({
  allowedRoles,
  children,
  nav,
}: {
  /** Roles allowed into this area; anyone else is sent to their home. */
  allowedRoles?: Role[];
  children: React.ReactNode;
  /**
   * "sidebar" is the staff console: many sections, so they need a rail.
   * "topbar" is for the personal consoles (agent, candidate, accreditor),
   * whose whole navigation is two or three links - a 264px sidebar holding
   * three items is mostly empty space, and it costs a phone its drawer.
   *
   * Left unset it follows the ROLE, which is what shared areas want: an
   * agent opening /profile should stay in the chrome they were already in,
   * not have the console reshape itself under them mid-navigation.
   */
  nav?: "sidebar" | "topbar";
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { isError, isLoading } = useGetMeQuery();
  const { initialized, role, user } = useAuthRole();
  const [drawerOpen, setDrawerOpen] = useState(false);
  // Desktop sidebar collapse (icon rail), remembered across visits. The
  // stored value is read via useSyncExternalStore (false during SSR, real
  // value after hydration); in-session toggles override it.
  const storedCollapsed = useSyncExternalStore(
    emptySubscribe,
    () => localStorage.getItem(COLLAPSE_KEY) === "1",
    () => false,
  );
  const [collapsedOverride, setCollapsedOverride] = useState<boolean | null>(null);
  const collapsed = collapsedOverride ?? storedCollapsed;

  const toggleCollapsed = () => {
    const next = !collapsed;
    localStorage.setItem(COLLAPSE_KEY, next ? "1" : "0");
    setCollapsedOverride(next);
  };

  const allowed = Boolean(role && (!allowedRoles || allowedRoles.includes(role)));

  // Keep the frontend-domain session marker fresh while a session exists, so
  // the server-side proxy gate keeps seeing a signal (see lib/session-marker).
  useEffect(() => {
    if (user) setSessionMarker();
  }, [user]);

  useEffect(() => {
    if (isLoading) return;
    if (isError || (initialized && !user)) {
      clearSessionMarker();
      router.replace("/login");
      return;
    }
    if (user?.mustChangePassword) {
      // Generated temporary passwords must be replaced before the console
      // can be used.
      router.replace("/password-setup");
      return;
    }
    if (role && !allowed) {
      router.replace("/profile");
    }
  }, [allowed, initialized, isError, isLoading, role, router, user]);

  if (isLoading || !user || !allowed || user.mustChangePassword) {
    return <LoadingScreen />;
  }

  const sidebar = (collapsedRail: boolean) => (
    <TooltipProvider delayDuration={0}>
    <div className="flex h-full flex-col">
      {/* Same h-16 + hairline as the top bar so the two lines meet. */}
      <div
        className={cn(
          "flex h-16 shrink-0 items-center border-b border-sidebar-border",
          collapsedRail ? "justify-center px-0" : "px-5",
        )}
      >
        <Logo href={role ? homeForRole(role) : "/"} showText={!collapsedRail} />
      </div>
      <NavList collapsed={collapsedRail} onNavigate={() => setDrawerOpen(false)} />
      {!collapsedRail && (
        <div className="border-t border-sidebar-border p-3">
          <p className="px-2 text-[11px] text-muted-foreground">
            Secured, audited elections
          </p>
        </div>
      )}
    </div>
    </TooltipProvider>
  );

  const chrome =
    nav ?? (role === "SUPER_ADMIN" || role === "ADMIN" ? "sidebar" : "topbar");

  if (chrome === "topbar" && role) {
    const links = sectionsForRole(role, user.capabilities ?? []).flatMap(
      (section) => section.items,
    );
    return (
      <div className="flex min-h-dvh flex-col bg-background">
        <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur">
          <div className="px-4 sm:px-6 lg:px-8">
            <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 py-3">
              <Logo href={homeForRole(role)} imgSize={30} textClassName="max-[380px]:hidden text-lg" />
              <div className="flex min-w-0 items-center gap-1.5">
                <ThemeToggle />
                {/* Which console you are in, immediately beside the account
                    menu: it describes who you are signed in as, so it belongs
                    against the avatar rather than the wordmark. */}
                <span className="hidden shrink-0 rounded-full border border-brand/40 bg-brand-muted px-2.5 py-0.5 text-[11px] font-medium whitespace-nowrap text-foreground sm:inline">
                  {ROLE_LABELS[role]}
                </span>
                <UserMenu />
              </div>
            </div>
          </div>
          {/* The links get their own row so long labels never collide with
              the account menu, and can scroll sideways on a narrow phone
              rather than wrapping into a second stack. */}
          <div className="px-4 pb-2 sm:px-6 lg:px-8">
            <nav className="no-scrollbar mx-auto flex w-full max-w-6xl gap-1 overflow-x-auto">
              {links.map((item) => (
                <TopNavLink item={item} key={item.href} />
              ))}
            </nav>
          </div>
        </header>

        <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          {/* Keyed by route so the enter animation replays on navigation. */}
          <div className="page-enter mx-auto w-full max-w-6xl" key={pathname}>
            {children}
          </div>
        </main>

        <ConsoleFooter />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "min-h-dvh bg-background lg:grid",
        collapsed ? "lg:grid-cols-[64px_1fr]" : "lg:grid-cols-[264px_1fr]",
      )}
    >
      {/* Desktop sidebar (full or icon rail) */}
      <aside className="hidden border-r border-sidebar-border bg-sidebar lg:block">
        <div className="sticky top-0 h-dvh">{sidebar(collapsed)}</div>
      </aside>

      {/* min-h-dvh so the footer sits at the bottom even on short pages. */}
      <div className="flex min-h-dvh min-w-0 flex-col">
        {/* Top bar - h-16 to mirror the sidebar header exactly. */}
        <header className="sticky top-0 z-40 flex h-16 items-center justify-between gap-3 border-b border-border bg-background/95 px-4 backdrop-blur sm:px-6">
          <div className="flex items-center gap-2">
            <Sheet onOpenChange={setDrawerOpen} open={drawerOpen}>
              <SheetTrigger asChild>
                <Button aria-label="Open navigation" className="lg:hidden" size="icon-sm" variant="ghost">
                  <Menu className="size-5" />
                </Button>
              </SheetTrigger>
              <SheetContent className="w-72 bg-sidebar p-0" side="left">
                <SheetTitle className="sr-only">Navigation</SheetTitle>
                {sidebar(false)}
              </SheetContent>
            </Sheet>
            <HeaderBackButton />
            {/* Desktop: collapse/expand the sidebar (DMS-style trigger). */}
            <Button
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              className="hidden lg:inline-flex"
              onClick={toggleCollapsed}
              size="icon-sm"
              variant="ghost"
            >
              {collapsed ? <PanelLeftOpen className="size-5" /> : <PanelLeftClose className="size-5" />}
            </Button>
          </div>
          <div className="flex items-center gap-1.5">
            <ThemeToggle />
            <UserMenu />
          </div>
        </header>

        <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <div className="page-enter mx-auto w-full max-w-6xl" key={pathname}>
            {children}
          </div>
        </main>

        <ConsoleFooter />
      </div>
    </div>
  );
}
