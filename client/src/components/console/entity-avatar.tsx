"use client";

// Small circular avatar for data-table rows (DMS admin-table style): the
// photo when there is one, initials on the brand disc otherwise.
import Image from "next/image";

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
        // `fill` because the disc above already fixes the box; without
        // optimisation these served full-size Cloudinary originals, and a
        // ballot or register page is mostly photographs. `sizes` keeps the
        // requested variant small - this never renders larger than 64px.
        <div className="relative size-full">
          <Image alt="" className="object-cover" fill sizes="64px" src={url} />
        </div>
      ) : (
        initialsOf(name)
      )}
    </div>
  );
}
