"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { getApiErrorMessage } from "@/utils/extract-api-error";
import { useLoginMutation, useVerifyTwoFactorMutation } from "@/redux/auth-api";

// Mirrors the backend loginSchema.
const loginSchema = z.object({
  emailOrPhone: z.string().min(1, "Email or phone is required"),
  password: z.string().min(4, "Password is too short"),
});
type LoginValues = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const router = useRouter();
  const [login, { isLoading }] = useLoginMutation();
  const [verify, { isLoading: verifying }] = useVerifyTwoFactorMutation();
  const [challengeToken, setChallengeToken] = useState<null | string>(null);
  const [code, setCode] = useState("");

  const form = useForm<LoginValues>({
    defaultValues: { emailOrPhone: "", password: "" },
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      const res = await login(values).unwrap();
      if (res.requiresTwoFactor && "challengeToken" in res.data) {
        setChallengeToken(res.data.challengeToken);
        toast.info("Enter your authenticator code to continue");
        return;
      }
      toast.success("Welcome back");
      router.push("/admin");
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Login failed"));
    }
  });

  const onVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!challengeToken) return;
    try {
      await verify({ challengeToken, code }).unwrap();
      toast.success("Welcome back");
      router.push("/admin");
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Invalid code"));
    }
  };

  return (
    <Card>
      <CardHeader>
        <span className="mb-1 flex size-9 items-center justify-center rounded-lg bg-brand-muted text-brand">
          <ShieldCheck className="size-5" />
        </span>
        <CardTitle className="text-lg">
          {challengeToken ? "Two-factor verification" : "Administrator sign in"}
        </CardTitle>
        <CardDescription>
          {challengeToken
            ? "Enter the 6-digit code from your authenticator app."
            : "Sign in to manage elections. Voters should use the voter portal."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {challengeToken ? (
          <form className="space-y-4" onSubmit={onVerify}>
            <Field label="Authentication code">
              <Input
                autoFocus
                inputMode="numeric"
                maxLength={8}
                onChange={(e) => setCode(e.target.value)}
                placeholder="123456"
                value={code}
              />
            </Field>
            <Button className="w-full" loading={verifying} type="submit" variant="brand">
              Verify and continue
            </Button>
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
          </form>
        )}
      </CardContent>
    </Card>
  );
}
