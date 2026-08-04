// Auth pages render their own AuthShell (centered card over the fixed site
// background). The layout mounts the guest gate: signed-in visitors are
// redirected to their home instead of ever seeing these forms again
// (/password-setup is exempt inside GuestOnly - it requires a session).
import { GuestOnly } from "@/components/auth/guest-only";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <GuestOnly>{children}</GuestOnly>;
}
