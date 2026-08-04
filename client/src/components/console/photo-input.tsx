"use client";

// Shared profile-photo picker for create forms: stage a file, preview it in
// a circle, discard or replace before submit. The parent owns the staged
// File and appends it to its FormData as `image`.
import { ImagePlus, X } from "lucide-react";
import { useEffect, useMemo, useRef } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

export function PhotoInput({
  file,
  label = "Profile photo",
  onChange,
}: {
  file: File | null;
  label?: string;
  onChange: (file: File | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  // Preview derives from the staged file; the effect only handles revocation.
  const preview = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);
  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  const stage = (picked: File | undefined) => {
    if (!picked) return;
    if (!picked.type.startsWith("image/")) {
      toast.error("Please choose an image file");
      return;
    }
    if (picked.size > 10 * 1024 * 1024) {
      toast.error("Image must be 10MB or smaller");
      return;
    }
    onChange(picked);
  };

  return (
    <div className="flex items-center gap-3">
      <div className="relative">
        <div className="grid size-14 shrink-0 place-items-center overflow-hidden rounded-full border border-border bg-muted/40">
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element -- local object URL preview
            <img alt={`${label} preview`} className="size-full object-cover" src={preview} />
          ) : (
            <ImagePlus className="size-5 text-muted-foreground" />
          )}
        </div>
        {file && (
          <button
            aria-label="Remove photo"
            className="absolute -top-1 -right-1 grid size-5 place-items-center rounded-full border border-border bg-background text-muted-foreground transition-colors hover:text-destructive"
            onClick={() => {
              onChange(null);
              if (inputRef.current) inputRef.current.value = "";
            }}
            type="button"
          >
            <X className="size-3" />
          </button>
        )}
      </div>
      <div className="min-w-0">
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">Optional. JPG or PNG, up to 10MB.</p>
        <input
          accept="image/*"
          className="hidden"
          onChange={(e) => stage(e.target.files?.[0])}
          ref={inputRef}
          type="file"
        />
        <Button
          className="mt-1.5"
          onClick={() => inputRef.current?.click()}
          size="sm"
          type="button"
          variant="outline"
        >
          {file ? "Replace photo" : "Choose photo"}
        </Button>
      </div>
    </div>
  );
}
