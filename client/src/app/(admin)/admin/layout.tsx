import { ConsoleShell } from "@/components/console/console-shell";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <ConsoleShell allowedRoles={["SUPER_ADMIN", "ADMIN"]}>{children}</ConsoleShell>;
}
