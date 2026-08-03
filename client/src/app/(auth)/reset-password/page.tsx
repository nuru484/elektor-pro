"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { AuthShell } from "@/components/auth/auth-shell";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useResetPasswordMutation } from "@/redux/profile-api";
import { getApiErrorMessage } from "@/utils/extract-api-error";
import {
  resetPasswordSchema,
  type ResetPasswordValues,
} from "@/validations/auth-validation";

function ResetPasswordForm() {
  const router = useRouter();
  const token = useSearchParams().get("token") ?? "";
  const [resetPassword, { isLoading }] = useResetPasswordMutation();

  const form = useForm<ResetPasswordValues>({
    defaultValues: { confirmPassword: "", newPassword: "" },
    resolver: zodResolver(resetPasswordSchema),
  });

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await resetPassword({ newPassword: values.newPassword, token }).unwrap();
      toast.success("Password reset. Sign in with your new password.");
      router.push("/login");
    } catch (error) {
      toast.error(getApiErrorMessage(error, "This reset link is invalid or expired"));
    }
  });

  if (!token) {
    return (
      <p className="text-center text-sm text-muted-foreground">
        This reset link is missing its token.{" "}
        <Link
          className="font-medium text-foreground transition-colors hover:text-muted-foreground"
          href="/forgot-password"
        >
          Request a new one
        </Link>
        .
      </p>
    );
  }

  return (
    <form className="space-y-5" noValidate onSubmit={onSubmit}>
      <Field error={form.formState.errors.newPassword?.message} label="New password">
        <Input autoComplete="new-password" autoFocus type="password" {...form.register("newPassword")} />
      </Field>
      <Field
        error={form.formState.errors.confirmPassword?.message}
        label="Confirm new password"
      >
        <Input autoComplete="new-password" type="password" {...form.register("confirmPassword")} />
      </Field>
      <Button className="w-full" loading={isLoading} type="submit">
        Reset password
      </Button>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <AuthShell
      backHref="/login"
      backLabel="Back to sign in"
      subtitle="Resetting your password signs you out of every device."
      title="Choose a new password"
    >
      {/* useSearchParams requires a Suspense boundary during prerender. */}
      <Suspense fallback={<Skeleton className="h-40 w-full" />}>
        <ResetPasswordForm />
      </Suspense>
    </AuthShell>
  );
}
