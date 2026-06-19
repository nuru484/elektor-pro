import Link from "next/link";

import { cn } from "@/lib/utils";

export function Logo({
  className,
  href = "/",
  showText = true,
}: {
  className?: string;
  href?: null | string;
  showText?: boolean;
}) {
  const inner = (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <span className="flex size-7 items-center justify-center rounded-md bg-brand text-brand-foreground">
        <svg className="size-4" fill="none" viewBox="0 0 24 24">
          <path
            d="M5 13l4 4L19 7"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2.5"
          />
        </svg>
      </span>
      {showText && (
        <span className="text-[0.95rem] font-semibold tracking-tight">
          Elektor<span className="text-brand">Pro</span>
        </span>
      )}
    </span>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
}
