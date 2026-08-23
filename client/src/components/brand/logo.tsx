"use client";

import Image from "next/image";
import Link from "next/link";

import { useBranding } from "@/hooks/use-branding";
import { cn } from "@/lib/utils";

/**
 * The brand lockup: the organization's mark and name where one is configured,
 * the Elektor Pro ballot-box mark and wordmark otherwise.
 *
 * `imgSize`/`textClassName` scale it for its context (nav, footer, sidebar,
 * auth card). The organization's own name renders as one piece: only the
 * platform wordmark carries the two-tone "Elektor/Pro" split, because that
 * split belongs to this product's name and not to somebody else's.
 */
export function Logo({
  className,
  href = "/",
  imgSize = 28,
  showText = true,
  textClassName,
}: {
  className?: string;
  href?: null | string;
  imgSize?: number;
  showText?: boolean;
  textClassName?: string;
}) {
  const brand = useBranding();

  const inner = (
    <span className={cn("inline-flex items-center gap-2", className)}>
      {/* An uploaded logo is any aspect ratio while the platform mark is
          square, so height is the fixed dimension and width follows. The
          declared width is generous on purpose: it is what the optimiser
          resizes to, and sizing it to the height would fetch a wide logo far
          too small to be sharp. */}
      <Image
        alt={brand.name}
        className="w-auto object-contain"
        height={imgSize}
        src={brand.logoUrl}
        style={{ height: imgSize }}
        width={imgSize * 5}
      />
      {showText && (
        <span
          className={cn(
            "text-[0.95rem] font-semibold tracking-tight",
            textClassName,
          )}
        >
          {brand.hasLogo || brand.name !== "Elektor Pro" ? (
            brand.name
          ) : (
            <>
              Elektor<span className="text-brand">Pro</span>
            </>
          )}
        </span>
      )}
    </span>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
}
