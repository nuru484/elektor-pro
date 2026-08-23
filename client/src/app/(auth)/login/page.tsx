"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import type { TwoFactorMethod } from "@/types/api";

import { AuthShell } from "@/components/auth/auth-shell";
import { homeForRole } from "@/components/console/nav-config";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { setSessionMarker } from "@/lib/session-marker";
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
        // Marker must exist before navigation: the proxy gate checks it on
        // the very next request to a protected route.
        setSessionMarker();
        toast.success("Signed in successfully");
        router.push(
          (res.data as { mustChangePassword?: boolean }).mustChangePassword
            ? "/password-setup"
            : homeForRole(res.data.role),
        );
      }
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Login failed"));
    }
  });

  const onVerify = codeForm.handleSubmit(async (values) => {
    if (!challenge) return;
    try {
      const res = await verify({ challengeToken: challenge.token, code: values.code }).unwrap();
      setSessionMarker();
      toast.success("Signed in successfully");
      router.push(
        (res.data as { mustChangePassword?: boolean }).mustChangePassword
          ? "/password-setup"
          : homeForRole(res.data.role),
      );
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Invalid code"));
    }
  });

  if (challenge) {
    return (
      <AuthShell
        subtitle={
          challenge.method === "EMAIL"
            ? "Enter the sign-in code we just sent to your email, or a recovery code."
            : "Enter the 6-digit code from your authenticator app, or a recovery code."
        }
        title="Two-factor verification"
      >
        <form className="space-y-5" noValidate onSubmit={onVerify}>
          <Field error={codeForm.formState.errors.code?.message} label="Authentication code">
            <Input
              autoComplete="one-time-code"
              autoFocus
              inputMode="numeric"
              placeholder="123456"
              spellCheck={false}
              {...codeForm.register("code")}
            />
          </Field>
          <Button className="w-full gap-2" loading={verifying} type="submit">
            Verify and continue
            {!verifying && <ArrowRight aria-hidden className="size-4" />}
          </Button>
          <button
            className="w-full text-center text-sm text-muted-foreground transition-colors hover:text-foreground"
            onClick={() => {
              setChallenge(null);
              codeForm.reset();
            }}
            type="button"
          >
            Back to sign in
          </button>
        </form>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Sign in to manage elections">
      <form className="space-y-5" noValidate onSubmit={onSubmit}>
        <Field error={form.formState.errors.emailOrPhone?.message} label="Email or phone">
          <Input
            autoComplete="username"
            autoFocus
            spellCheck={false}
            placeholder="you@example.com"
            {...form.register("emailOrPhone")}
          />
        </Field>
        <Field error={form.formState.errors.password?.message} label="Password">
          <PasswordInput
            autoComplete="current-password"
            placeholder="••••••••"
            {...form.register("password")}
          />
        </Field>
        <div className="flex justify-end">
          <Link
            className="text-sm font-medium text-foreground transition-colors hover:text-muted-foreground"
            href="/forgot-password"
          >
            Forgot password?
          </Link>
        </div>
        <Button className="w-full gap-2" loading={isLoading} type="submit">
          Sign in
          {!isLoading && <ArrowRight aria-hidden className="size-4" />}
        </Button>
        <p className="text-center text-sm text-muted-foreground">
          Voting in an election?{" "}
          <Link
            className="font-medium text-foreground transition-colors hover:text-muted-foreground"
            href="/vote"
          >
            Voter portal
          </Link>
        </p>
        <p className="text-center text-sm text-muted-foreground">
          Just looking around?{" "}
          <Link className="font-medium text-brand hover:underline" href="/demo">
            Try a demo account
          </Link>
        </p>
      </form>
    </AuthShell>
  );
}
