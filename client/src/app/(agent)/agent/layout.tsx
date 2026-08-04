import { ConsoleShell } from "@/components/console/console-shell";

export default function AgentLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <ConsoleShell allowedRoles={["AGENT"]}>{children}</ConsoleShell>;
}
