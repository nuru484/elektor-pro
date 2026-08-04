"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { AuthShell } from "@/components/auth/auth-shell";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useForgotPasswordMutation } from "@/redux/profile-api";
import { getApiErrorMessage } from "@/utils/extract-api-error";
import {
  forgotPasswordSchema,
  type ForgotPasswordValues,
} from "@/validations/auth-validation";

export default function ForgotPasswordPage() {
  const [forgotPassword, { isLoading }] = useForgotPasswordMutation();
  const [sent, setSent] = useState(false);

  const form = useForm<ForgotPasswordValues>({
    defaultValues: { emailOrPhone: "" },
    resolver: zodResolver(forgotPasswordSchema),
  });

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await forgotPassword(values).unwrap();
      setSent(true);
    } catch (error) {
      toast.error(getApiErrorMessage(error));
    }
  });

  return (
    <AuthShell
      backHref="/login"
      backLabel="Back to sign in"
      subtitle={
        sent
          ? "If an account exists for that email or phone, a reset link is on its way."
          : "Enter the email or phone on your account and we'll send a reset link."
      }
      title="Reset your password"
    >
      {sent ? (
        <p className="text-center text-sm text-muted-foreground">
          Didn&apos;t get it? Check your spam folder, or{" "}
          <button
            className="font-medium text-foreground transition-colors hover:text-muted-foreground"
            onClick={() => setSent(false)}
            type="button"
          >
            try again
          </button>
          .
        </p>
      ) : (
        <form className="space-y-5" noValidate onSubmit={onSubmit}>
          <Field error={form.formState.errors.emailOrPhone?.message} label="Email or phone">
            <Input autoFocus placeholder="you@example.com" {...form.register("emailOrPhone")} />
          </Field>
          <Button className="w-full" loading={isLoading} type="submit">
            Send reset link
          </Button>
        </form>
      )}
    </AuthShell>
  );
}
