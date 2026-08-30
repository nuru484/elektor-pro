"use client";

import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Icon-only back control that sits beside a page heading. In-tab history is
 * preferred so the visitor lands back on the exact list or tab they left;
 * a page opened directly, with no history behind it, goes to `href` instead
 * of dead-ending.
 */
export function BackButton({
  className,
  href,
  label,
}: {
  className?: string;
  /** Where to go when the page was opened directly. */
  href: string;
  /** Accessible name for the arrow, e.g. "Back to elections". */
  label: string;
}) {
  const router = useRouter();
  return (
    <Button
      aria-label={label}
      className={cn("-ml-2 shrink-0", className)}
      onClick={() => {
        if (window.history.length > 1) router.back();
        else router.push(href);
      }}
      size="icon-lg"
      title={label}
      type="button"
      variant="ghost"
    >
      <ArrowLeft aria-hidden className="size-5" />
    </Button>
  );
}
