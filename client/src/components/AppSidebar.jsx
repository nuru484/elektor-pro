"use client";
import { usePathname } from "next/navigation";
import {
  Home,
  Vote,
  Users,
  BarChart2,
  Settings,
  Shield,
  FileText,
  LogOut,
  User,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { logout } from "@/actions/auth";
import { useAuthUserQuery } from "@/redux/api/apiSlice";

export function AppSidebar() {
  const pathname = usePathname();
  const { data } = useAuthUserQuery();

  const isAdmin = ["SUPER_ADMIN", "ADMIN"].includes(data?.user?.role);
  const logoutRoute = isAdmin ? "admin-login" : "login";

  const mainNavItems = [
    { title: "Dashboard", href: "/", icon: Home },
    { title: "Active Votes", href: "/dashboard/votes", icon: Vote },
    ...(isAdmin
      ? [{ title: "Voters", href: "/dashboard/voters", icon: Vote }]
      : []),
    { title: "Candidates", href: "/dashboard/candidates", icon: Users },
    { title: "Portfolios", href: "/dashboard/portfolios", icon: Users },
    { title: "Results", href: "/dashboard/results", icon: BarChart2 },
  ];

  const managementItems = [
    { title: "Elections", href: "/dashboard/elections", icon: FileText },
    ...(isAdmin
      ? [
          {
            title: "Audit Trail",
            href: "/dashboard/audit-trail",
            icon: Shield,
          },
          { title: "User Management", href: "/dashboard/users", icon: User },
        ]
      : []),
  ];

  const systemItems = [
    { title: "Settings", href: "/dashboard/settings", icon: Settings },
  ];

  return (
    <Sidebar
      collapsible="icon"
      className="bg-sidebar text-sidebar-foreground border-r border-sidebar-border shadow-sm"
    >
      <SidebarHeader className="border-b border-sidebar-border py-4">
        <SidebarMenuButton>
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-sidebar-primary rounded-lg flex items-center justify-center">
              <Vote className="h-4 w-4 text-sidebar-primary-foreground" />
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-semibold text-sidebar-foreground">
                VoteSecure
              </span>
              <span className="text-xs text-sidebar-muted-foreground">
                Election System
              </span>
            </div>
          </div>
        </SidebarMenuButton>
      </SidebarHeader>

      <SidebarContent className="px-2">
        {/* Main Navigation */}
        <SidebarGroup>
          <SidebarGroupLabel className="text-xs font-medium text-sidebar-muted-foreground px-2">
            Main
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="space-y-1">
              {mainNavItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    className={cn(
                      "group relative flex items-center px-3 py-2.5 text-sm font-medium rounded-lg transition-all duration-200 hover:shadow-sm",
                      pathname === item.href
                        ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm"
                        : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                    )}
                  >
                    <Link href={item.href} className="flex items-center w-full">
                      <item.icon className="mr-3 h-4 w-4 flex-shrink-0" />
                      <span className="truncate">{item.title}</span>
                      {pathname === item.href && (
                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-sidebar-primary-foreground rounded-r-full" />
                      )}
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Management Section */}
        {managementItems.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel className="text-xs font-medium text-sidebar-muted-foreground px-2 mb-2 mt-3">
              Management
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu className="space-y-1">
                {managementItems.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      className={cn(
                        "group relative flex items-center px-3 py-2.5 text-sm font-medium rounded-lg transition-all duration-200 hover:shadow-sm",
                        pathname === item.href
                          ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm"
                          : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                      )}
                    >
                      <Link
                        href={item.href}
                        className="flex items-center w-full"
                      >
                        <item.icon className="mr-3 h-4 w-4 flex-shrink-0" />
                        <span className="truncate">{item.title}</span>
                        {pathname === item.href && (
                          <div className="absolute left-0 top-0 bottom-0 w-1 bg-sidebar-primary-foreground rounded-r-full" />
                        )}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {/* System Section */}
        <SidebarGroup>
          <SidebarGroupLabel className="text-xs font-medium text-sidebar-muted-foreground px-2 mb-2 mt-3">
            System
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="space-y-1">
              {systemItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    className={cn(
                      "group relative flex items-center px-3 py-2.5 text-sm font-medium rounded-lg transition-all duration-200 hover:shadow-sm",
                      pathname === item.href
                        ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm"
                        : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                    )}
                  >
                    <Link href={item.href} className="flex items-center w-full">
                      <item.icon className="mr-3 h-4 w-4 flex-shrink-0" />
                      <span className="truncate">{item.title}</span>
                      {pathname === item.href && (
                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-sidebar-primary-foreground rounded-r-full" />
                      )}
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-2">
        <SidebarMenuButton asChild>
          <Button
            variant="ghost"
            onClick={() => logout(logoutRoute)}
            className="w-full justify-start text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground hover:cursor-pointer transition-colors duration-200"
          >
            <LogOut className="mr-3 h-4 w-4" />
            <span>Logout</span>
          </Button>
        </SidebarMenuButton>
      </SidebarFooter>
    </Sidebar>
  );
}
