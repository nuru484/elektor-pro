"use client";

// How a voter reaches the people running their election.
//
// Renders nothing unless the organization has supplied a way to be reached -
// an empty "need help?" line is worse than none, since it implies support
// exists and then declines to say where.
import { Mail, Phone } from "lucide-react";

import { useBranding } from "@/hooks/use-branding";

export function SupportContact({ className }: { className?: string }) {
  const brand = useBranding();
  if (!brand.supportEmail && !brand.supportPhone) return null;

  return (
    <p
      className={`flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground ${className ?? ""}`}
    >
      <span>Need help with your vote?</span>
      {brand.supportEmail && (
        <a
          className="inline-flex items-center gap-1.5 transition-colors hover:text-brand"
          href={`mailto:${brand.supportEmail}`}
        >
          <Mail aria-hidden className="size-3.5" />
          {brand.supportEmail}
        </a>
      )}
      {brand.supportPhone && (
        <a
          className="inline-flex items-center gap-1.5 whitespace-nowrap transition-colors hover:text-brand"
          href={`tel:${brand.supportPhone.replace(/\s+/g, "")}`}
        >
          <Phone aria-hidden className="size-3.5" />
          {brand.supportPhone}
        </a>
      )}
    </p>
  );
}
