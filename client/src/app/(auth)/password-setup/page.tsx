"use client";

// Forced first-login password change: admin-created accounts arrive with a
// generated temporary password and land here before anything else. The
// change signs other devices out and clears the requirement.
import { ArrowRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { AuthShell } from "@/components/auth/auth-shell";
import { homeForRole } from "@/components/console/nav-config";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useAuthRole } from "@/hooks/use-auth-role";
import { useGetMeQuery } from "@/redux/auth-api";
import { useChangePasswordMutation } from "@/redux/profile-api";
import { getApiErrorMessage } from "@/utils/extract-api-error";

export default function PasswordSetupPage() {
  const router = useRouter();
  useGetMeQuery();
  const { role } = useAuthRole();
  const [changePassword, { isLoading }] = useChangePasswordMutation();
  const [error, setError] = useState<null | string>(null);

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    const f = new FormData(e.currentTarget);
    const newPassword = String(f.get("newPassword"));
    if (newPassword !== String(f.get("confirmPassword"))) {
      setError("Passwords do not match");
      return;
    }
    if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/.test(newPassword)) {
      setError("Use at least 8 characters with upper and lower case letters and a digit");
      return;
    }
    try {
      await changePassword({
        currentPassword: String(f.get("currentPassword")),
        newPassword,
      }).unwrap();
      toast.success("Password set - welcome aboard");
      router.replace(role ? homeForRole(role) : "/profile");
    } catch (err) {
      toast.error(getApiErrorMessage(err, "Could not set password"));
    }
  };

  return (
    <AuthShell
      subtitle="Replace the temporary password you were given before continuing."
      title="Set your password"
    >
      <form className="space-y-5" onSubmit={onSubmit}>
        <Field label="Temporary password">
          <Input
            autoComplete="current-password"
            autoFocus
            name="currentPassword"
            placeholder="The password you signed in with"
            required
            type="password"
          />
        </Field>
        <Field hint="At least 8 characters with upper, lower, and a digit." label="New password">
          <Input
            autoComplete="new-password"
            name="newPassword"
            placeholder="Your own password"
            required
            type="password"
          />
        </Field>
        <Field error={error ?? undefined} label="Confirm new password">
          <Input
            autoComplete="new-password"
            name="confirmPassword"
            placeholder="Repeat the new password"
            required
            type="password"
          />
        </Field>
        <Button className="w-full gap-2" loading={isLoading} type="submit">
          Set password and continue
          {!isLoading && <ArrowRight className="size-4" />}
        </Button>
      </form>
    </AuthShell>
  );
}
