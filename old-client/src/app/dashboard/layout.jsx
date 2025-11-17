import {
  SidebarProvider,
  SidebarTrigger,
  SidebarInset,
} from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";

export default function Layout({ children }) {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 border-b bg-background px-4">
          <SidebarTrigger className="-ml-1" />
          <h1 className="text-lg font-semibold text-foreground">
            Election Dashboard
          </h1>
        </header>
        <main className="flex flex-1 flex-col p-4">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
