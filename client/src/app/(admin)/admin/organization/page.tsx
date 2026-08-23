"use client";

// Organization settings: identity, branding (logo/favicon uploads + colors),
// contact, and localization. Read-only-first cards on the profile-section
// pattern - inputs appear only behind Edit. Text/color changes ride
// maker-checker (202 = staged for approval); image uploads apply directly.
import { zodResolver } from "@hookform/resolvers/zod";
import { Building2, ImagePlus, Pencil } from "lucide-react";
import { useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import type { Organization } from "@/types/api";

import {
  CARD_MOBILE,
  CARD_PAD_MOBILE,
} from "@/components/profile/details-section";
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
import { SettingsCardsSkeleton } from "@/components/console/skeletons";
import { EmptyState, ErrorState, PageHeader } from "@/components/ui/states";
import { useAuthRole } from "@/hooks/use-auth-role";
import {
  useGetOrganizationQuery,
  useUpdateOrganizationImageMutation,
  useUpdateOrganizationMutation,
} from "@/redux/governance-api";
import { getApiErrorMessage } from "@/utils/extract-api-error";

const pendingAware = (res: unknown, applied: string): string =>
  (res as { pending?: boolean }).pending ? "Submitted for approval" : applied;

/** Output AND input are string records so zodResolver's generics line up. */
type CardSchema = z.ZodType<Record<string, string>, Record<string, string>>;

/** One read-only-first settings card driving a subset of org fields. */
function SettingsCard({
  description,
  fields,
  org,
  schema,
  title,
}: {
  description: string;
  fields: {
    label: string;
    name: string;
    placeholder: string;
    type?: string;
  }[];
  org: Organization;
  schema: CardSchema;
  title: string;
}) {
  const [editing, setEditing] = useState(false);
  const [update, { isLoading: saving }] = useUpdateOrganizationMutation();

  const defaults: Record<string, string> = Object.fromEntries(
    fields.map((f) => [
      f.name,
      String((org as unknown as Record<string, unknown>)[f.name] ?? ""),
    ]),
  );
  const form = useForm<Record<string, string>>({
    defaultValues: defaults,
    resolver: zodResolver(schema),
  });

  const onSave = form.handleSubmit(async (values) => {
    // Empty optional strings become null (clear), never "".
    const body = Object.fromEntries(
      Object.entries(values).map(([key, value]) => [key, value === "" ? null : value]),
    );
    try {
      const res = await update(body).unwrap();
      toast.success(pendingAware(res, `${title} updated`));
      setEditing(false);
    } catch (error) {
      toast.error(getApiErrorMessage(error));
    }
  });

  return (
    <Card className={CARD_MOBILE}>
      <CardHeader className={CARD_PAD_MOBILE}>
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className={CARD_PAD_MOBILE}>
        {editing ? (
          <form className="max-w-lg space-y-4" onSubmit={onSave}>
            {fields.map((f) => (
              <Field
                error={form.formState.errors[f.name]?.message as string | undefined}
                key={f.name}
                label={f.label}
              >
                <Input
                  placeholder={f.placeholder}
                  type={f.type ?? "text"}
                  {...form.register(f.name)}
                />
              </Field>
            ))}
            <div className="flex gap-2">
              <Button
                onClick={() => {
                  form.reset(defaults);
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
          <div className="flex items-start justify-between gap-3">
            <dl className="grid flex-1 gap-4 sm:grid-cols-2">
              {fields.map((f) => (
                <div key={f.name}>
                  <dt className="text-xs text-muted-foreground">{f.label}</dt>
                  <dd className="mt-0.5 break-words text-sm font-medium">
                    {String(
                      (org as unknown as Record<string, unknown>)[f.name] ?? "",
                    ) || "—"}
                  </dd>
                </div>
              ))}
            </dl>
            <Button onClick={() => setEditing(true)} size="sm" variant="outline">
              <Pencil className="size-3.5" /> Edit
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/** Stage → preview → confirm upload for one branding image. */
function BrandingImage({
  field,
  label,
  url,
}: {
  field: "favicon" | "logo";
  label: string;
  url: null | string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [staged, setStaged] = useState<File | null>(null);
  const [preview, setPreview] = useState<null | string>(null);
  const [upload, { isLoading: uploading }] = useUpdateOrganizationImageMutation();

  const stage = (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image file");
      return;
    }
    if (preview) URL.revokeObjectURL(preview);
    setStaged(file);
    setPreview(URL.createObjectURL(file));
  };

  const clearStaged = () => {
    if (preview) URL.revokeObjectURL(preview);
    setStaged(null);
    setPreview(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  const confirm = async () => {
    if (!staged) return;
    try {
      await upload({ field, file: staged }).unwrap();
      toast.success(`${label} updated`);
      clearStaged();
    } catch (error) {
      toast.error(getApiErrorMessage(error));
    }
  };

  const shown = preview ?? url;

  return (
    <div className="flex items-center gap-4">
      <div className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-lg border border-border bg-muted/40">
        {shown ? (
          // eslint-disable-next-line @next/next/no-img-element -- Cloudinary/object URL preview
          <img alt={`${label} preview`} className="size-full object-contain" src={shown} />
        ) : (
          <ImagePlus className="size-5 text-muted-foreground" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">PNG or JPG, up to 10MB.</p>
        <div className="mt-2 flex flex-wrap gap-2">
          <input
            accept="image/*"
            className="hidden"
            onChange={(e) => stage(e.target.files?.[0])}
            ref={inputRef}
            type="file"
          />
          {staged ? (
            <>
              <Button loading={uploading} onClick={confirm} size="sm" variant="brand">
                Confirm upload
              </Button>
              <Button onClick={clearStaged} size="sm" type="button" variant="outline">
                Discard
              </Button>
            </>
          ) : (
            <Button
              onClick={() => inputRef.current?.click()}
              size="sm"
              type="button"
              variant="outline"
            >
              Choose image
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

// Cast: each object schema outputs string-valued fields, which is what the
// shared card's Record<string, string> form state needs.
const asCardSchema = (schema: z.ZodTypeAny): CardSchema =>
  schema as CardSchema;

const identitySchema = asCardSchema(
  z.object({
    name: z.string().min(2, "Name is too short").max(150),
    website: z.union([z.literal(""), z.url("Enter a full URL")]),
  }),
);

const contactSchema = asCardSchema(
  z.object({
    supportEmail: z.union([z.literal(""), z.email("Enter a valid email")]),
    supportPhone: z.string().max(30),
  }),
);

/** One brand color: native picker + hex + RGB, all kept in sync. */
export default function OrganizationPage() {
  const { can, initialized } = useAuthRole();
  const allowed = can("MANAGE_ORGANIZATION");
  const { data, isError, isLoading } = useGetOrganizationQuery(undefined, {
    skip: initialized && !allowed,
  });

  if (initialized && !allowed) {
    return (
      <EmptyState
        description="You don't have permission to manage organization settings."
        icon={Building2}
        title="Not available"
      />
    );
  }

  const org = data?.data;

  return (
    <div className="space-y-6">
      <PageHeader
        description="Your organization's identity, branding, and contact details across the platform."
        title="Organization"
      />
      {isLoading ? (
        <SettingsCardsSkeleton cards={4} />
      ) : isError || !org ? (
        <ErrorState />
      ) : (
        <div className="space-y-6 max-sm:space-y-8">
          <SettingsCard
            description="The name and website shown to voters and staff."
            fields={[
              { label: "Organization name", name: "name", placeholder: "e.g. Elektor Pro" },
              {
                label: "Website",
                name: "website",
                placeholder: "https://example.org",
                type: "url",
              },
            ]}
            org={org}
            schema={identitySchema}
            title="Identity"
          />

          <Card className={CARD_MOBILE}>
            <CardHeader className={CARD_PAD_MOBILE}>
              <CardTitle className="text-base">Branding</CardTitle>
              <CardDescription>
                The logo and favicon shown on your election pages. Uploads apply
                immediately.
              </CardDescription>
            </CardHeader>
            {/* Side by side once there is room: they are two of the same
                thing, and stacked they push the rest of the settings a card
                further down for no reason. */}
            <CardContent className={`${CARD_PAD_MOBILE} grid gap-5 md:grid-cols-2`}>
              <BrandingImage field="logo" label="Logo" url={org.logoUrl} />
              <BrandingImage field="favicon" label="Favicon" url={org.faviconUrl} />
            </CardContent>
          </Card>


          <SettingsCard
            description="Where voters and staff can reach your election desk."
            fields={[
              {
                label: "Support email",
                name: "supportEmail",
                placeholder: "support@example.org",
                type: "email",
              },
              {
                label: "Support phone",
                name: "supportPhone",
                placeholder: "+233 20 000 0000",
                type: "tel",
              },
            ]}
            org={org}
            schema={contactSchema}
            title="Contact"
          />

        </div>
      )}
    </div>
  );
}
