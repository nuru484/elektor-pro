"use client";

// Standalone profile-photo editor for detail pages: tap the camera to stage
// a new photo, preview it in place, then confirm or discard - independent of
// any other form on the page.
import { Camera } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { initialsOf } from "@/utils/format-date";
import { getApiErrorMessage } from "@/utils/extract-api-error";

export function AvatarUpdater({
  canEdit,
  name,
  onUpload,
  url,
}: {
  canEdit: boolean;
  name: string;
  /** Performs the upload; resolves when the server accepted it. */
  onUpload: (file: File) => Promise<unknown>;
  url?: null | string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [staged, setStaged] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const preview = useMemo(
    () => (staged ? URL.createObjectURL(staged) : null),
    [staged],
  );
  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  const confirm = async () => {
    if (!staged) return;
    setSaving(true);
    try {
      await onUpload(staged);
      toast.success("Profile photo updated");
      setStaged(null);
    } catch (error) {
      toast.error(getApiErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const shown = preview ?? url;

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative">
        <div className="grid size-20 place-items-center overflow-hidden rounded-full border border-border bg-brand text-xl font-semibold text-brand-foreground">
          {shown ? (
            // eslint-disable-next-line @next/next/no-img-element -- Cloudinary/object URL
            <img alt="" className="size-full object-cover" src={shown} />
          ) : (
            initialsOf(name)
          )}
        </div>
        {canEdit && (
          <button
            aria-label="Change profile photo"
            className="absolute -right-1 -bottom-1 grid size-7 place-items-center rounded-full border border-border bg-background text-muted-foreground transition-colors hover:text-foreground"
            onClick={() => inputRef.current?.click()}
            type="button"
          >
            <Camera className="size-3.5" />
          </button>
        )}
        <input
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file?.type.startsWith("image/")) setStaged(file);
            else if (file) toast.error("Please choose an image file");
          }}
          ref={inputRef}
          type="file"
        />
      </div>
      {staged && (
        <div className="flex gap-1.5">
          <Button loading={saving} onClick={confirm} size="sm" variant="brand">
            Save photo
          </Button>
          <Button
            onClick={() => {
              setStaged(null);
              if (inputRef.current) inputRef.current.value = "";
            }}
            size="sm"
            type="button"
            variant="ghost"
          >
            Discard
          </Button>
        </div>
      )}
    </div>
  );
}
