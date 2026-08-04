import Image from "next/image";
import Link from "next/link";

import { cn } from "@/lib/utils";

/**
 * The brand lockup: the ballot-box mark from public/ plus the ElektorPro
 * wordmark. `imgSize`/`textClassName` scale it for its context (nav, footer,
 * sidebar, auth card).
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
  const inner = (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <Image
        alt="Elektor Pro"
        className="rounded-md"
        height={imgSize}
        src="/logo-mark.png"
        width={imgSize}
      />
      {showText && (
        <span className={cn("text-[0.95rem] font-semibold tracking-tight", textClassName)}>
          Elektor<span className="text-brand">Pro</span>
        </span>
      )}
    </span>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
}
