"use client";

import { X } from "lucide-react";
import { useEffect } from "react";

import { Button } from "./button";

export function Modal({
  children,
  description,
  onClose,
  open,
  title,
}: {
  children: React.ReactNode;
  description?: string;
  onClose: () => void;
  open: boolean;
  title: string;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div aria-modal className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="dialog">
      <div className="absolute inset-0 bg-foreground/40" onClick={onClose} />
      <div className="relative max-h-[90dvh] w-full overflow-y-auto rounded-t-2xl border border-border bg-card p-6 sm:max-w-lg sm:rounded-2xl">
        {/* min-w-0 + anywhere: titles/descriptions interpolate user-authored
            names, and a worst-case unbroken token must wrap, not escape. */}
        <div className="mb-4 flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1 space-y-1">
            <h2 className="min-w-0 text-lg font-semibold [overflow-wrap:anywhere]">
              {title}
            </h2>
            {description && (
              <p className="min-w-0 text-sm text-muted-foreground [overflow-wrap:anywhere]">
                {description}
              </p>
            )}
          </div>
          <Button className="shrink-0" onClick={onClose} size="icon" variant="ghost">
            <X className="size-4" />
          </Button>
        </div>
        {children}
      </div>
    </div>
  );
}
