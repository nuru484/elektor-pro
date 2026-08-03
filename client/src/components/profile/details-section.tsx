"use client";

// Profile details: photo, names, and two-step verified email/phone changes.
import { zodResolver } from "@hookform/resolvers/zod";
import { Camera, Mail, Phone } from "lucide-react";
import { useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import type { CurrentUser } from "@/types/api";

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
  useConfirmEmailChangeMutation,
  useConfirmPhoneChangeMutation,
  useRequestEmailChangeMutation,
  useRequestPhoneChangeMutation,
  useUpdateProfileMutation,
  useUpdateProfilePictureMutation,
} from "@/redux/profile-api";
import { getApiErrorMessage } from "@/utils/extract-api-error";
import {
  emailChangeSchema,
  type EmailChangeValues,
  otpCodeSchema,
  type OtpCodeValues,
  phoneChangeSchema,
  type PhoneChangeValues,
  updateProfileSchema,
  type UpdateProfileValues,
} from "@/validations/auth-validation";

/**
 * Generic two-step "change contact" dialog: enter the new value, then the
 * code sent to it. Shared by the email and phone flows.
 */
function ContactChangeDialog({
  confirm,
  description,
  label,
  onClose,
  open,
  placeholder,
  request,
  title,
  type,
}: {
  confirm: (code: string) => Promise<unknown>;
  description: string;
  label: string;
  onClose: () => void;
  open: boolean;
  placeholder: string;
  request: (value: string) => Promise<unknown>;
  title: string;
  type: "email" | "tel";
}) {
  const [stage, setStage] = useState<"code" | "value">("value");
  const [busy, setBusy] = useState(false);

  const schema = type === "email" ? emailChangeSchema : phoneChangeSchema;
  const fieldName = type === "email" ? "email" : "phone";
  const valueForm = useForm<EmailChangeValues & PhoneChangeValues>({
    defaultValues: { email: "", phone: "" },
    resolver: zodResolver(schema as never),
  });
  const codeForm = useForm<OtpCodeValues>({
    defaultValues: { code: "" },
    resolver: zodResolver(otpCodeSchema),
  });

  const close = () => {
    setStage("value");
    valueForm.reset();
    codeForm.reset();
    onClose();
  };

  const onRequest = valueForm.handleSubmit(async (values) => {
    setBusy(true);
    try {
      await request(values[fieldName]);
      setStage("code");
      toast.success("Verification code sent");
    } catch (error) {
      toast.error(getApiErrorMessage(error));
    } finally {
      setBusy(false);
    }
  });

  const onConfirm = codeForm.handleSubmit(async (values) => {
    setBusy(true);
    try {
      await confirm(values.code);
      toast.success(`${label} updated`);
      close();
    } catch (error) {
      toast.error(getApiErrorMessage(error));
    } finally {
      setBusy(false);
    }
  });

  return (
    <Dialog onOpenChange={(next) => !next && close()} open={open}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {stage === "value"
              ? description
              : "Enter the verification code we just sent to confirm the change."}
          </DialogDescription>
        </DialogHeader>
        {stage === "value" ? (
          <form className="space-y-4" onSubmit={onRequest}>
            <Field error={valueForm.formState.errors[fieldName]?.message} label={label}>
              <Input
                autoFocus
                placeholder={placeholder}
                type={type}
                {...valueForm.register(fieldName)}
              />
            </Field>
            <Button className="w-full" loading={busy} type="submit" variant="brand">
              Send verification code
            </Button>
          </form>
        ) : (
          <form className="space-y-4" onSubmit={onConfirm}>
            <Field error={codeForm.formState.errors.code?.message} label="Verification code">
              <Input
                autoFocus
                inputMode="numeric"
                placeholder="123456"
                {...codeForm.register("code")}
              />
            </Field>
            <Button className="w-full" loading={busy} type="submit" variant="brand">
              Confirm change
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function DetailsSection({ user }: { user: CurrentUser }) {
  const [updateProfile, { isLoading: saving }] = useUpdateProfileMutation();
  const [uploadPicture, { isLoading: uploading }] = useUpdateProfilePictureMutation();
  const [requestEmail] = useRequestEmailChangeMutation();
  const [confirmEmail] = useConfirmEmailChangeMutation();
  const [requestPhone] = useRequestPhoneChangeMutation();
  const [confirmPhone] = useConfirmPhoneChangeMutation();
  const [dialog, setDialog] = useState<"email" | "phone" | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const form = useForm<UpdateProfileValues>({
    defaultValues: { firstName: user.firstName, lastName: user.lastName },
    resolver: zodResolver(updateProfileSchema),
  });

  const onSave = form.handleSubmit(async (values) => {
    try {
      await updateProfile(values).unwrap();
      toast.success("Profile updated");
    } catch (error) {
      toast.error(getApiErrorMessage(error));
    }
  });

  const onPickPhoto = async (file: File | undefined) => {
    if (!file) return;
    const body = new FormData();
    body.append("image", file);
    try {
      await uploadPicture(body).unwrap();
      toast.success("Profile photo updated");
    } catch (error) {
      toast.error(getApiErrorMessage(error));
    }
  };

  const initials = `${user.firstName[0] ?? ""}${user.lastName[0] ?? ""}`.toUpperCase();

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Photo</CardTitle>
          <CardDescription>Shown on your account and, for candidates, the ballot.</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center gap-4">
          <span className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand text-lg font-semibold text-brand-foreground">
            {user.profilePicture ? (
              // eslint-disable-next-line @next/next/no-img-element -- Cloudinary avatar
              <img alt="Profile photo" className="size-full object-cover" src={user.profilePicture} />
            ) : (
              initials
            )}
          </span>
          <div>
            <input
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={(e) => void onPickPhoto(e.target.files?.[0])}
              ref={fileRef}
              type="file"
            />
            <Button
              loading={uploading}
              onClick={() => fileRef.current?.click()}
              size="sm"
              type="button"
              variant="outline"
            >
              <Camera className="size-4" /> Change photo
            </Button>
            <p className="mt-1.5 text-xs text-muted-foreground">JPEG, PNG or WebP, up to 10 MB.</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Name</CardTitle>
          <CardDescription>How your name appears across the platform.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={onSave}>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field error={form.formState.errors.firstName?.message} label="First name">
                <Input {...form.register("firstName")} />
              </Field>
              <Field error={form.formState.errors.lastName?.message} label="Last name">
                <Input {...form.register("lastName")} />
              </Field>
            </div>
            <Button loading={saving} type="submit" variant="brand">
              Save changes
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Contact</CardTitle>
          <CardDescription>
            Changes are verified with a one-time code sent to the new address or number.
          </CardDescription>
        </CardHeader>
        <CardContent className="divide-y divide-border">
          <div className="flex flex-col gap-2 pb-4 min-[480px]:flex-row min-[480px]:items-center min-[480px]:justify-between">
            <div className="flex min-w-0 items-center gap-3">
              <Mail className="size-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0">
                <p className="text-sm font-medium">Email</p>
                <p className="min-w-0 text-sm text-muted-foreground [overflow-wrap:anywhere]">
                  {user.email ?? "Not set"}
                </p>
              </div>
            </div>
            <Button onClick={() => setDialog("email")} size="sm" variant="outline">
              Change
            </Button>
          </div>
          <div className="flex flex-col gap-2 pt-4 min-[480px]:flex-row min-[480px]:items-center min-[480px]:justify-between">
            <div className="flex min-w-0 items-center gap-3">
              <Phone className="size-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0">
                <p className="text-sm font-medium">Phone</p>
                <p className="text-sm text-muted-foreground [overflow-wrap:anywhere]">
                  {user.phone ?? "Not set"}
                </p>
              </div>
            </div>
            <Button onClick={() => setDialog("phone")} size="sm" variant="outline">
              Change
            </Button>
          </div>
        </CardContent>
      </Card>

      <ContactChangeDialog
        confirm={(code) => confirmEmail({ code }).unwrap()}
        description="We'll send a verification code to the new address."
        label="New email address"
        onClose={() => setDialog(null)}
        open={dialog === "email"}
        placeholder="you@example.com"
        request={(email) => requestEmail({ email }).unwrap()}
        title="Change email address"
        type="email"
      />
      <ContactChangeDialog
        confirm={(code) => confirmPhone({ code }).unwrap()}
        description="We'll text a verification code to the new number."
        label="New phone number"
        onClose={() => setDialog(null)}
        open={dialog === "phone"}
        placeholder="+233..."
        request={(phone) => requestPhone({ phone }).unwrap()}
        title="Change phone number"
        type="tel"
      />
    </div>
  );
}
