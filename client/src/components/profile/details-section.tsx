"use client";

// Profile details: photo, names, and verified email/phone changes. Everything
// renders read-only first; active inputs appear only after the matching Edit
// button is pressed, and contact changes expand INLINE below their row (no
// dialogs) - value step, then the code sent to the new contact.
import { zodResolver } from "@hookform/resolvers/zod";
import { Camera, Mail, Pencil, Phone } from "lucide-react";
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

/** Cards dissolve on phones: no box-in-box, just the page gutter. */
export const CARD_MOBILE =
  "max-sm:border-0 max-sm:bg-transparent max-sm:py-0 max-sm:shadow-none";
export const CARD_PAD_MOBILE = "max-sm:px-0";

/**
 * Inline two-step contact change, expanded below its row: enter the new
 * value, then the code sent to it.
 */
function ContactChangeInline({
  confirm,
  label,
  onClose,
  placeholder,
  request,
  type,
}: {
  confirm: (code: string) => Promise<unknown>;
  label: string;
  onClose: () => void;
  placeholder: string;
  request: (value: string) => Promise<unknown>;
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
      onClose();
    } catch (error) {
      toast.error(getApiErrorMessage(error));
    } finally {
      setBusy(false);
    }
  });

  return (
    <div className="mt-4 rounded-lg border border-border bg-muted/30 p-4">
      {stage === "value" ? (
        // Width-capped: an email/phone never needs a full-card input.
        <form className="max-w-md space-y-4" onSubmit={onRequest}>
          <Field
            error={valueForm.formState.errors[fieldName]?.message}
            hint="We'll send a verification code to confirm it's yours."
            label={label}
          >
            <Input
              autoFocus
              placeholder={placeholder}
              type={type}
              {...valueForm.register(fieldName)}
            />
          </Field>
          <div className="flex gap-2">
            <Button onClick={onClose} size="sm" type="button" variant="outline">
              Cancel
            </Button>
            <Button loading={busy} size="sm" type="submit" variant="brand">
              Send verification code
            </Button>
          </div>
        </form>
      ) : (
        <form className="max-w-md space-y-4" onSubmit={onConfirm}>
          <Field
            error={codeForm.formState.errors.code?.message}
            hint="Enter the code we just sent to confirm the change."
            label="Verification code"
          >
            <Input
              autoFocus
              className="max-w-40"
              inputMode="numeric"
              placeholder="123456"
              {...codeForm.register("code")}
            />
          </Field>
          <div className="flex gap-2">
            <Button onClick={onClose} size="sm" type="button" variant="outline">
              Cancel
            </Button>
            <Button loading={busy} size="sm" type="submit" variant="brand">
              Confirm change
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}

function NameCard({ user }: { user: CurrentUser }) {
  const [updateProfile, { isLoading: saving }] = useUpdateProfileMutation();
  const [editing, setEditing] = useState(false);

  const form = useForm<UpdateProfileValues>({
    defaultValues: { firstName: user.firstName, lastName: user.lastName },
    resolver: zodResolver(updateProfileSchema),
  });

  const onSave = form.handleSubmit(async (values) => {
    try {
      await updateProfile(values).unwrap();
      toast.success("Profile updated");
      setEditing(false);
    } catch (error) {
      toast.error(getApiErrorMessage(error));
    }
  });

  return (
    <Card className={CARD_MOBILE}>
      <CardHeader className={CARD_PAD_MOBILE}>
        <CardTitle className="text-base">Name</CardTitle>
        <CardDescription>How your name appears across the platform.</CardDescription>
      </CardHeader>
      <CardContent className={CARD_PAD_MOBILE}>
        {editing ? (
          <form className="space-y-4" onSubmit={onSave}>
            {/* Width-capped: names never need full-card inputs. */}
            <div className="grid max-w-lg gap-4 sm:grid-cols-2">
              <Field error={form.formState.errors.firstName?.message} label="First name">
                <Input placeholder="e.g. Ama" {...form.register("firstName")} />
              </Field>
              <Field error={form.formState.errors.lastName?.message} label="Last name">
                <Input placeholder="e.g. Owusu" {...form.register("lastName")} />
              </Field>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={() => {
                  form.reset({ firstName: user.firstName, lastName: user.lastName });
                  setEditing(false);
                }}
                type="button"
                variant="outline"
              >
                Cancel
              </Button>
              <Button loading={saving} type="submit" variant="brand">
                Save changes
              </Button>
            </div>
          </form>
        ) : (
          <div className="flex items-center justify-between gap-3">
            <div className="grid flex-1 gap-4 sm:grid-cols-2">
              <div>
                <p className="text-xs text-muted-foreground">First name</p>
                <p className="mt-0.5 text-sm font-medium">{user.firstName}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Last name</p>
                <p className="mt-0.5 text-sm font-medium">{user.lastName}</p>
              </div>
            </div>
            <Button onClick={() => setEditing(true)} size="sm" variant="outline">
              <Pencil className="size-3.5" /> Edit
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function PhotoCard({ user }: { user: CurrentUser }) {
  const [uploadPicture, { isLoading: uploading }] = useUpdateProfilePictureMutation();
  const [viewOpen, setViewOpen] = useState(false);
  const [pendingPhoto, setPendingPhoto] = useState<{ file: File; url: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  /** Selecting a file only stages a preview - nothing is uploaded yet. */
  const onPickPhoto = (file: File | undefined) => {
    if (!file) return;
    setPendingPhoto({ file, url: URL.createObjectURL(file) });
  };

  const discardPendingPhoto = () => {
    if (pendingPhoto) URL.revokeObjectURL(pendingPhoto.url);
    setPendingPhoto(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  /** The upload happens only after the user confirms the preview. */
  const onConfirmPhoto = async () => {
    if (!pendingPhoto) return;
    const body = new FormData();
    body.append("image", pendingPhoto.file);
    try {
      await uploadPicture(body).unwrap();
      toast.success("Profile photo updated");
      discardPendingPhoto();
    } catch (error) {
      toast.error(getApiErrorMessage(error));
    }
  };

  const initials = `${user.firstName[0] ?? ""}${user.lastName[0] ?? ""}`.toUpperCase();

  return (
    <Card className={CARD_MOBILE}>
      <CardHeader className={CARD_PAD_MOBILE}>
        <CardTitle className="text-base">Photo</CardTitle>
        <CardDescription>Shown on your account and, for candidates, the ballot.</CardDescription>
      </CardHeader>
      <CardContent className={`flex items-center gap-4 ${CARD_PAD_MOBILE}`}>
        <button
          aria-label={user.profilePicture ? "View profile photo" : "No profile photo yet"}
          className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand text-lg font-semibold text-brand-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
          disabled={!user.profilePicture}
          onClick={() => setViewOpen(true)}
          type="button"
        >
          {user.profilePicture ? (
            // eslint-disable-next-line @next/next/no-img-element -- Cloudinary avatar
            <img alt="Profile photo" className="size-full object-cover" src={user.profilePicture} />
          ) : (
            initials
          )}
        </button>
        <div>
          <input
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={(e) => onPickPhoto(e.target.files?.[0])}
            ref={fileRef}
            type="file"
          />
          <Button onClick={() => fileRef.current?.click()} size="sm" type="button" variant="outline">
            <Camera className="size-4" /> Change photo
          </Button>
          <p className="mt-1.5 text-xs text-muted-foreground">
            JPEG, PNG or WebP, up to 10 MB. Tap the photo to view it full size.
          </p>
        </div>
      </CardContent>

      {/* Preview + confirm before anything is uploaded. */}
      <Dialog onOpenChange={(next) => !next && discardPendingPhoto()} open={pendingPhoto !== null}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Use this photo?</DialogTitle>
            <DialogDescription>
              This is how your profile photo will look. Confirm to save it.
            </DialogDescription>
          </DialogHeader>
          {pendingPhoto && (
            // eslint-disable-next-line @next/next/no-img-element -- local object URL preview
            <img
              alt="New profile photo preview"
              className="aspect-square w-full rounded-xl border border-border object-cover"
              src={pendingPhoto.url}
            />
          )}
          <div className="flex gap-2">
            <Button className="flex-1" onClick={discardPendingPhoto} type="button" variant="outline">
              Cancel
            </Button>
            <Button
              className="flex-1"
              loading={uploading}
              onClick={onConfirmPhoto}
              type="button"
              variant="brand"
            >
              Save photo
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Full-size square view of the current photo. */}
      <Dialog onOpenChange={setViewOpen} open={viewOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Profile photo</DialogTitle>
          </DialogHeader>
          {user.profilePicture && (
            // eslint-disable-next-line @next/next/no-img-element -- Cloudinary image
            <img
              alt="Profile photo, full size"
              className="aspect-square w-full rounded-xl border border-border object-cover"
              src={user.profilePicture}
            />
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function ContactCard({ user }: { user: CurrentUser }) {
  const [requestEmail] = useRequestEmailChangeMutation();
  const [confirmEmail] = useConfirmEmailChangeMutation();
  const [requestPhone] = useRequestPhoneChangeMutation();
  const [confirmPhone] = useConfirmPhoneChangeMutation();
  const [editing, setEditing] = useState<"email" | "phone" | null>(null);

  return (
    <Card className={CARD_MOBILE}>
      <CardHeader className={CARD_PAD_MOBILE}>
        <CardTitle className="text-base">Contact</CardTitle>
        <CardDescription>
          Changes are verified with a one-time code sent to the new address or number.
        </CardDescription>
      </CardHeader>
      <CardContent className={`divide-y divide-border ${CARD_PAD_MOBILE}`}>
        <div className="pb-4">
          <div className="flex flex-col gap-2 min-[480px]:flex-row min-[480px]:items-center min-[480px]:justify-between">
            <div className="flex min-w-0 items-center gap-3">
              <Mail className="size-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0">
                <p className="text-sm font-medium">Email</p>
                <p className="min-w-0 text-sm text-muted-foreground [overflow-wrap:anywhere]">
                  {user.email ?? "Not set"}
                </p>
              </div>
            </div>
            <Button
              onClick={() => setEditing(editing === "email" ? null : "email")}
              size="sm"
              variant="outline"
            >
              <Pencil className="size-3.5" /> Change
            </Button>
          </div>
          {editing === "email" && (
            <ContactChangeInline
              confirm={(code) => confirmEmail({ code }).unwrap()}
              label="New email address"
              onClose={() => setEditing(null)}
              placeholder="you@example.com"
              request={(email) => requestEmail({ email }).unwrap()}
              type="email"
            />
          )}
        </div>
        <div className="pt-4">
          <div className="flex flex-col gap-2 min-[480px]:flex-row min-[480px]:items-center min-[480px]:justify-between">
            <div className="flex min-w-0 items-center gap-3">
              <Phone className="size-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0">
                <p className="text-sm font-medium">Phone</p>
                <p className="text-sm text-muted-foreground [overflow-wrap:anywhere]">
                  {user.phone ?? "Not set"}
                </p>
              </div>
            </div>
            <Button
              onClick={() => setEditing(editing === "phone" ? null : "phone")}
              size="sm"
              variant="outline"
            >
              <Pencil className="size-3.5" /> Change
            </Button>
          </div>
          {editing === "phone" && (
            <ContactChangeInline
              confirm={(code) => confirmPhone({ code }).unwrap()}
              label="New phone number"
              onClose={() => setEditing(null)}
              placeholder="e.g. +233 24 000 0000"
              request={(phone) => requestPhone({ phone }).unwrap()}
              type="tel"
            />
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function DetailsSection({ user }: { user: CurrentUser }) {
  return (
    <div className="space-y-6 max-sm:space-y-8">
      <PhotoCard user={user} />
      <NameCard user={user} />
      <ContactCard user={user} />
    </div>
  );
}
