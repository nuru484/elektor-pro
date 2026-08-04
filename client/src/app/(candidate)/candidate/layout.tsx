import { ConsoleShell } from "@/components/console/console-shell";

export default function CandidateLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <ConsoleShell allowedRoles={["CANDIDATE", "ADMIN", "SUPER_ADMIN"]}>
      {children}
    </ConsoleShell>
  );
}
