import { ConsoleShell } from "@/components/console/console-shell";

export default function AccreditLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <ConsoleShell allowedRoles={["ACCREDITOR", "ADMIN", "SUPER_ADMIN"]}>
      {children}
    </ConsoleShell>
  );
}
