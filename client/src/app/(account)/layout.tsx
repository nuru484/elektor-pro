import { ConsoleShell } from "@/components/console/console-shell";

/** Account area: available to every signed-in role. */
export default function AccountLayout({ children }: { children: React.ReactNode }) {
  return <ConsoleShell>{children}</ConsoleShell>;
}
