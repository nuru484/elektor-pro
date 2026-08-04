"use client";

// DMS-style guest gate for auth pages: a signed-in visitor never sees the
// login/forgot/reset forms again - they bounce straight to their role's
// home (or to /password-setup while a temporary password is unresolved,
// which is why that page is exempt).
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";

import { homeForRole } from "@/components/console/nav-config";
import { LoadingScreen } from "@/components/ui/loading-screen";
import { useAuthRole } from "@/hooks/use-auth-role";
import { useGetMeQuery } from "@/redux/auth-api";

export function GuestOnly({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const exempt = pathname === "/password-setup";
  useGetMeQuery(undefined, { skip: exempt });
  const { user } = useAuthRole();

  const redirectTarget =
    user && !exempt
      ? user.mustChangePassword
        ? "/password-setup"
        : homeForRole(user.role)
      : null;

  useEffect(() => {
    if (redirectTarget) router.replace(redirectTarget);
  }, [redirectTarget, router]);

  if (redirectTarget) return <LoadingScreen />;
  return children;
}
