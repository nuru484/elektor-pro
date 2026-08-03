"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { LockKeyhole } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
      <p className="text-sm text-muted-foreground">
        This reset link is missing its token.{" "}
        <Link className="text-brand hover:underline" href="/forgot-password">
          Request a new one
        </Link>
        .
      </p>
    );
  }

  return (
    <form className="space-y-4" onSubmit={onSubmit}>
      <Field error={form.formState.errors.newPassword?.message} label="New password">
        <Input autoFocus type="password" {...form.register("newPassword")} />
      </Field>
      <Field
        error={form.formState.errors.confirmPassword?.message}
        label="Confirm new password"
      >
        <Input type="password" {...form.register("confirmPassword")} />
      </Field>
      <Button className="w-full" loading={isLoading} type="submit" variant="brand">
        Reset password
      </Button>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <Card>
      <CardHeader>
        <span className="mb-1 flex size-9 items-center justify-center rounded-lg bg-brand-muted text-brand">
          <LockKeyhole className="size-5" />
        </span>
        <CardTitle className="text-lg">Choose a new password</CardTitle>
        <CardDescription>
          Resetting your password signs you out of every device.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* useSearchParams requires a Suspense boundary during prerender. */}
        <Suspense fallback={<Skeleton className="h-40 w-full" />}>
          <ResetPasswordForm />
        </Suspense>
      </CardContent>
    </Card>
  );
}
