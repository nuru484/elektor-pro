"use client";

// Security: password change, and 2FA enrollment (authenticator app or email
// codes) with recovery-code display, plus disable.
import { zodResolver } from "@hookform/resolvers/zod";
import { Copy, KeyRound, ShieldCheck, ShieldOff, Smartphone } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import type { CurrentUser } from "@/types/api";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  useActivateTwoFactorMutation,
  useSetupTwoFactorMutation,
} from "@/redux/auth-api";
import {
  useActivateEmailTwoFactorMutation,
  useChangePasswordMutation,
  useDisableTwoFactorMutation,
  useRequestEmailTwoFactorMutation,
} from "@/redux/profile-api";
import { CARD_MOBILE, CARD_PAD_MOBILE } from "@/components/profile/details-section";
import { getApiErrorMessage } from "@/utils/extract-api-error";
import {
  changePasswordSchema,
  type ChangePasswordValues,
  otpCodeSchema,
  type OtpCodeValues,
} from "@/validations/auth-validation";

function RecoveryCodes({ codes, onDone }: { codes: string[]; onDone: () => void }) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Store these one-time recovery codes somewhere safe. Each works once if you
        lose access to your second factor.
      </p>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 rounded-lg border border-border bg-muted/50 p-4 font-mono text-sm">
        {codes.map((code) => (
          <span key={code}>{code}</span>
        ))}
      </div>
      <div className="flex gap-2">
        <Button
          onClick={() => {
            void navigator.clipboard.writeText(codes.join("\n"));
            toast.success("Recovery codes copied");
          }}
          size="sm"
          type="button"
          variant="outline"
        >
          <Copy className="size-4" /> Copy all
        </Button>
        <Button onClick={onDone} size="sm" type="button" variant="brand">
          I have saved them
        </Button>
      </div>
    </div>
  );
}

function TotpDialog({ onClose, open }: { onClose: () => void; open: boolean }) {
  const [setup, { data, isLoading: settingUp, reset }] = useSetupTwoFactorMutation();
  const [activate, { isLoading: activating }] = useActivateTwoFactorMutation();
  const [recoveryCodes, setRecoveryCodes] = useState<null | string[]>(null);
  const codeForm = useForm<OtpCodeValues>({
    defaultValues: { code: "" },
    resolver: zodResolver(otpCodeSchema),
  });

  const close = () => {
    reset();
    setRecoveryCodes(null);
    codeForm.reset();
    onClose();
  };

  const onActivate = codeForm.handleSubmit(async (values) => {
    try {
      const result = await activate({ code: values.code }).unwrap();
      setRecoveryCodes(result.data.recoveryCodes);
    } catch (error) {
      toast.error(getApiErrorMessage(error));
    }
  });

  return (
    <Dialog onOpenChange={(next) => !next && close()} open={open}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Authenticator app</DialogTitle>
          <DialogDescription>
            {recoveryCodes
              ? "Two-factor authentication is now on."
              : "Scan the QR code with your authenticator app, then enter the 6-digit code it shows."}
          </DialogDescription>
        </DialogHeader>
        {recoveryCodes ? (
          <RecoveryCodes codes={recoveryCodes} onDone={close} />
        ) : data ? (
          <form className="space-y-4" onSubmit={onActivate}>
            <div className="flex justify-center rounded-lg border border-border bg-white p-4">
              {/* eslint-disable-next-line @next/next/no-img-element -- data URL QR */}
              <img alt="TOTP enrollment QR code" className="size-44" src={data.data.qrCode} />
            </div>
            <Field error={codeForm.formState.errors.code?.message} label="6-digit code">
              <Input autoFocus className="max-w-40" inputMode="numeric" placeholder="123456" {...codeForm.register("code")} />
            </Field>
            <Button className="w-full" loading={activating} type="submit" variant="brand">
              Turn on two-factor
            </Button>
          </form>
        ) : (
          <Button
            className="w-full"
            loading={settingUp}
            onClick={() => void setup()}
            type="button"
            variant="brand"
          >
            Generate QR code
          </Button>
        )}
      </DialogContent>
    </Dialog>
  );
}

function EmailTwoFactorDialog({ onClose, open }: { onClose: () => void; open: boolean }) {
  const [request, { data, isLoading: requesting, reset }] = useRequestEmailTwoFactorMutation();
  const [activate, { isLoading: activating }] = useActivateEmailTwoFactorMutation();
  const [recoveryCodes, setRecoveryCodes] = useState<null | string[]>(null);
  const codeForm = useForm<OtpCodeValues>({
    defaultValues: { code: "" },
    resolver: zodResolver(otpCodeSchema),
  });

  const close = () => {
    reset();
    setRecoveryCodes(null);
    codeForm.reset();
    onClose();
  };

  const onActivate = codeForm.handleSubmit(async (values) => {
    try {
      const result = await activate({ code: values.code }).unwrap();
      setRecoveryCodes(result.data.recoveryCodes);
    } catch (error) {
      toast.error(getApiErrorMessage(error));
    }
  });

  return (
    <Dialog onOpenChange={(next) => !next && close()} open={open}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Email codes</DialogTitle>
          <DialogDescription>
            {recoveryCodes
              ? "Two-factor authentication is now on."
              : data
                ? `Enter the code we sent to ${data.data.emailMasked}.`
                : "Each sign-in will require a one-time code sent to your email."}
          </DialogDescription>
        </DialogHeader>
        {recoveryCodes ? (
          <RecoveryCodes codes={recoveryCodes} onDone={close} />
        ) : data ? (
          <form className="space-y-4" onSubmit={onActivate}>
            <Field error={codeForm.formState.errors.code?.message} label="Verification code">
              <Input autoFocus className="max-w-40" inputMode="numeric" placeholder="123456" {...codeForm.register("code")} />
            </Field>
            <Button className="w-full" loading={activating} type="submit" variant="brand">
              Turn on two-factor
            </Button>
          </form>
        ) : (
          <Button
            className="w-full"
            loading={requesting}
            onClick={() => void request()}
            type="button"
            variant="brand"
          >
            Send confirmation code
          </Button>
        )}
      </DialogContent>
    </Dialog>
  );
}

function DisableDialog({ onClose, open }: { onClose: () => void; open: boolean }) {
  const [disable, { isLoading }] = useDisableTwoFactorMutation();
  const [password, setPassword] = useState("");

  return (
    <Dialog onOpenChange={(next) => !next && onClose()} open={open}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Turn off two-factor</DialogTitle>
          <DialogDescription>
            Confirm your password to disable two-factor authentication.
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            try {
              await disable({ password }).unwrap();
              setPassword("");
              toast.success("Two-factor authentication disabled");
              onClose();
            } catch (error) {
              toast.error(getApiErrorMessage(error));
            }
          }}
        >
          <Field label="Password">
            <Input
              autoFocus
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              value={password}
            />
          </Field>
          <Button className="w-full" loading={isLoading} type="submit" variant="destructive">
            <ShieldOff className="size-4" /> Turn off two-factor
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function SecuritySection({ user }: { user: CurrentUser }) {
  const [changePassword, { isLoading: changing }] = useChangePasswordMutation();
  const [dialog, setDialog] = useState<"disable" | "email" | "totp" | null>(null);
  const [editingPassword, setEditingPassword] = useState(false);

  const form = useForm<ChangePasswordValues>({
    defaultValues: { confirmPassword: "", currentPassword: "", newPassword: "" },
    resolver: zodResolver(changePasswordSchema),
  });

  const closePasswordForm = () => {
    form.reset();
    setEditingPassword(false);
  };

  const onChangePassword = form.handleSubmit(async (values) => {
    try {
      await changePassword({
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
      }).unwrap();
      closePasswordForm();
      toast.success("Password changed. Other devices have been signed out.");
    } catch (error) {
      toast.error(getApiErrorMessage(error));
    }
  });

  return (
    <div className="space-y-6 max-sm:space-y-8">
      <Card className={CARD_MOBILE}>
        <CardHeader className={CARD_PAD_MOBILE}>
          <CardTitle className="flex items-center gap-2 text-base">
            <KeyRound className="size-4 text-brand" /> Password
          </CardTitle>
          <CardDescription>
            Changing your password signs out every other device.
          </CardDescription>
        </CardHeader>
        <CardContent className={CARD_PAD_MOBILE}>
          {editingPassword ? (
            <form className="max-w-lg space-y-4" onSubmit={onChangePassword}>
              <Field
                error={form.formState.errors.currentPassword?.message}
                label="Current password"
              >
                <Input placeholder="Your current password" type="password" {...form.register("currentPassword")} />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field error={form.formState.errors.newPassword?.message} label="New password">
                  <Input placeholder="At least 8 characters" type="password" {...form.register("newPassword")} />
                </Field>
                <Field
                  error={form.formState.errors.confirmPassword?.message}
                  label="Confirm new password"
                >
                  <Input placeholder="Repeat the new password" type="password" {...form.register("confirmPassword")} />
                </Field>
              </div>
              <div className="flex gap-2">
                <Button onClick={closePasswordForm} type="button" variant="outline">
                  Cancel
                </Button>
                <Button loading={changing} type="submit" variant="brand">
                  Change password
                </Button>
              </div>
            </form>
          ) : (
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs text-muted-foreground">Password</p>
                <p className="mt-0.5 font-mono text-sm tracking-widest">••••••••••</p>
              </div>
              <Button onClick={() => setEditingPassword(true)} size="sm" variant="outline">
                Change password
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className={CARD_MOBILE}>
        <CardHeader className={CARD_PAD_MOBILE}>
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldCheck className="size-4 text-brand" /> Two-factor authentication
          </CardTitle>
          <CardDescription>
            A second step at sign-in keeps your account safe even if your password leaks.
          </CardDescription>
        </CardHeader>
        <CardContent className={`space-y-4 ${CARD_PAD_MOBILE}`}>
          <div className="flex items-center gap-2">
            {user.twoFactorEnabled ? (
              <>
                <Badge variant="success">Enabled</Badge>
                <span className="text-sm text-muted-foreground">
                  {user.twoFactorMethod === "EMAIL" ? "Email codes" : "Authenticator app"}
                </span>
              </>
            ) : (
              <Badge variant="outline">Off</Badge>
            )}
          </div>
          {user.twoFactorEnabled ? (
            <Button onClick={() => setDialog("disable")} size="sm" variant="outline">
              <ShieldOff className="size-4" /> Turn off
            </Button>
          ) : (
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => setDialog("totp")} size="sm" variant="brand">
                <Smartphone className="size-4" /> Use an authenticator app
              </Button>
              <Button onClick={() => setDialog("email")} size="sm" variant="outline">
                Use email codes
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <TotpDialog onClose={() => setDialog(null)} open={dialog === "totp"} />
      <EmailTwoFactorDialog onClose={() => setDialog(null)} open={dialog === "email"} />
      <DisableDialog onClose={() => setDialog(null)} open={dialog === "disable"} />
    </div>
  );
}
