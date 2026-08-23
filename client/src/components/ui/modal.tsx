"use client";

// A titled dialog that slides up from the bottom edge on phones and centres
// itself from sm up.
//
// It delegates to the Radix dialog rather than positioning a fixed div: that
// is what supplies the focus trap, the return of focus to the trigger on
// close, the escape handler, the scroll lock, aria-modal wired to the real
// title, and the inert background. A hand-rolled overlay gets the visuals
// right and every one of those wrong.
import { Dialog as DialogPrimitive } from "radix-ui";

import { cn } from "@/lib/utils";

export function Modal({
  children,
  className,
  description,
  onClose,
  open,
  title,
}: {
  children: React.ReactNode;
  className?: string;
  description?: string;
  onClose: () => void;
  open: boolean;
  title: string;
}) {
  return (
    <DialogPrimitive.Root
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      open={open}
    >
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-foreground/40 data-[state=closed]:animate-[overlay-out_0.18s_ease-in] data-[state=open]:animate-[overlay-in_0.2s_ease-out]" />
        <DialogPrimitive.Content
          className={cn(
            // max-h + internal scroll: tall worst-case content must never push
            // actions off small screens (dvh - mobile browser chrome).
            // overscroll-contain stops a scroll that reaches the end of the
            // dialog from chaining to the page underneath it.
            "fixed inset-x-0 bottom-0 z-50 max-h-[90dvh] overflow-y-auto overscroll-contain border border-border bg-card p-6 outline-none",
            "data-[state=closed]:animate-[content-out_0.18s_ease-in] data-[state=open]:animate-[content-in_0.22s_cubic-bezier(0.2,0.7,0.2,1)]",
            "sm:top-[50%] sm:bottom-auto sm:left-[50%] sm:w-full sm:max-w-lg sm:translate-x-[-50%] sm:translate-y-[-50%]",
            className,
          )}
        >
          {/* min-w-0 + anywhere: titles and descriptions interpolate
              user-authored names, and a worst-case unbroken token must wrap
              rather than escape the panel. */}
          <div className="mb-4 flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1 space-y-1">
              <DialogPrimitive.Title className="font-display min-w-0 text-lg font-semibold [overflow-wrap:anywhere]">
                {title}
              </DialogPrimitive.Title>
              {description ? (
                <DialogPrimitive.Description className="min-w-0 text-sm text-muted-foreground [overflow-wrap:anywhere]">
                  {description}
                </DialogPrimitive.Description>
              ) : (
                // Radix warns when a dialog has no description; this says
                // "there deliberately isn't one" without rendering anything.
                <DialogPrimitive.Description className="sr-only">
                  {title}
                </DialogPrimitive.Description>
              )}
            </div>
            <DialogPrimitive.Close
              aria-label="Close dialog"
              className="grid size-9 shrink-0 place-items-center text-muted-foreground transition-colors outline-none hover:bg-accent hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
            >
              <svg
                aria-hidden
                className="size-4"
                fill="none"
                stroke="currentColor"
                strokeLinecap="round"
                strokeWidth="2"
                viewBox="0 0 24 24"
              >
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </DialogPrimitive.Close>
          </div>
          {children}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
