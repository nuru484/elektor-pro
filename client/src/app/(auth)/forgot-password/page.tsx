"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { KeyRound } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
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
    <Card>
      <CardHeader>
        <span className="mb-1 flex size-9 items-center justify-center rounded-lg bg-brand-muted text-brand">
          <KeyRound className="size-5" />
        </span>
        <CardTitle className="text-lg">Reset your password</CardTitle>
        <CardDescription>
          {sent
            ? "If an account exists for that email or phone, a reset link is on its way."
            : "Enter the email or phone on your account and we'll send a reset link."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {sent ? (
          <p className="text-sm text-muted-foreground">
            Didn&apos;t get it? Check your spam folder, or{" "}
            <button
              className="text-brand hover:underline"
              onClick={() => setSent(false)}
              type="button"
            >
              try again
            </button>
            .
          </p>
        ) : (
          <form className="space-y-4" onSubmit={onSubmit}>
            <Field error={form.formState.errors.emailOrPhone?.message} label="Email or phone">
              <Input autoFocus placeholder="you@example.com" {...form.register("emailOrPhone")} />
            </Field>
            <Button className="w-full" loading={isLoading} type="submit" variant="brand">
              Send reset link
            </Button>
            <p className="text-center text-xs text-muted-foreground">
              <Link className="hover:text-foreground" href="/login">
                Back to sign in
              </Link>
            </p>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
