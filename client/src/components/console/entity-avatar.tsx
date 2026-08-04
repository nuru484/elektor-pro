"use client";

// Small circular avatar for data-table rows (DMS admin-table style): the
// photo when there is one, initials on the brand disc otherwise.
import { initialsOf } from "@/utils/format-date";

export function EntityAvatar({
  name,
  size = "size-8",
  url,
}: {
  name: string;
  size?: string;
  url?: null | string;
}) {
  return (
    <div
      className={`grid ${size} shrink-0 place-items-center overflow-hidden rounded-full border border-border bg-brand text-[11px] font-semibold text-brand-foreground`}
    >
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element -- tiny Cloudinary avatar
        <img alt="" className="size-full object-cover" src={url} />
      ) : (
        initialsOf(name)
      )}
    </div>
  );
}
