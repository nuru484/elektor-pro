"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import type { TwoFactorMethod } from "@/types/api";

import { homeForRole } from "@/components/console/nav-config";
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
import { useLoginMutation, useVerifyTwoFactorMutation } from "@/redux/auth-api";
import { getApiErrorMessage } from "@/utils/extract-api-error";
import {
  loginSchema,
  type LoginValues,
  otpCodeSchema,
  type OtpCodeValues,
} from "@/validations/auth-validation";

interface Challenge {
  method: TwoFactorMethod;
  token: string;
}

export default function LoginPage() {
  const router = useRouter();
  const [login, { isLoading }] = useLoginMutation();
  const [verify, { isLoading: verifying }] = useVerifyTwoFactorMutation();
  const [challenge, setChallenge] = useState<Challenge | null>(null);

  const form = useForm<LoginValues>({
    defaultValues: { emailOrPhone: "", password: "" },
    resolver: zodResolver(loginSchema),
  });
  const codeForm = useForm<OtpCodeValues>({
    defaultValues: { code: "" },
    resolver: zodResolver(otpCodeSchema),
  });

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      const res = await login(values).unwrap();
      if (res.requiresTwoFactor && "challengeToken" in res.data) {
        setChallenge({
          method: (res.data as { method?: TwoFactorMethod }).method ?? "TOTP",
          token: res.data.challengeToken,
        });
        return;
      }
      if (!("challengeToken" in res.data)) {
        toast.success("Welcome back");
        router.push(homeForRole(res.data.role));
      }
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Login failed"));
    }
  });

  const onVerify = codeForm.handleSubmit(async (values) => {
    if (!challenge) return;
    try {
      const res = await verify({ challengeToken: challenge.token, code: values.code }).unwrap();
      toast.success("Welcome back");
      router.push(homeForRole(res.data.role));
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Invalid code"));
    }
  });

  return (
    <Card>
      <CardHeader>
        <span className="mb-1 flex size-9 items-center justify-center rounded-lg bg-brand-muted text-brand">
          <ShieldCheck className="size-5" />
        </span>
        <CardTitle className="text-lg">
          {challenge ? "Two-factor verification" : "Staff sign in"}
        </CardTitle>
        <CardDescription>
          {challenge
            ? challenge.method === "EMAIL"
              ? "Enter the sign-in code we just sent to your email (or a recovery code)."
              : "Enter the 6-digit code from your authenticator app (or a recovery code)."
            : "Sign in to manage elections. Voters should use the voter portal."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {challenge ? (
          <form className="space-y-4" onSubmit={onVerify}>
            <Field error={codeForm.formState.errors.code?.message} label="Authentication code">
              <Input
                autoFocus
                inputMode="numeric"
                placeholder="123456"
                {...codeForm.register("code")}
              />
            </Field>
            <Button className="w-full" loading={verifying} type="submit" variant="brand">
              Verify and continue
            </Button>
            <button
              className="w-full text-center text-xs text-muted-foreground hover:text-foreground"
              onClick={() => {
                setChallenge(null);
                codeForm.reset();
              }}
              type="button"
            >
              Back to sign in
            </button>
          </form>
        ) : (
          <form className="space-y-4" onSubmit={onSubmit}>
            <Field error={form.formState.errors.emailOrPhone?.message} label="Email or phone">
              <Input autoFocus placeholder="you@example.com" {...form.register("emailOrPhone")} />
            </Field>
            <Field error={form.formState.errors.password?.message} label="Password">
              <Input placeholder="••••••••" type="password" {...form.register("password")} />
            </Field>
            <Button className="w-full" loading={isLoading} type="submit" variant="brand">
              Sign in
            </Button>
            <p className="text-center text-xs text-muted-foreground">
              <Link className="hover:text-foreground" href="/forgot-password">
                Forgot your password?
              </Link>
              <span className="mx-2">·</span>
              <Link className="hover:text-foreground" href="/vote">
                Voter portal
              </Link>
            </p>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
