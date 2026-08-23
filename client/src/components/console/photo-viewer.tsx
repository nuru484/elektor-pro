"use client";

// Full-screen photo viewer. A candidate's photo is identity evidence - an
// agent checking they are looking at the right person, or a candidate
// confirming what voters see on the ballot, needs more than a 36px disc. Any
// avatar can opt in by wrapping itself in `PhotoViewerTrigger`.
import { X, ZoomIn } from "lucide-react";
import Image from "next/image";
import { useEffect, useState } from "react";

import { createPortal } from "react-dom";

function Overlay({
  alt,
  onClose,
  url,
}: {
  alt: string;
  onClose: () => void;
  url: string;
}) {
  // Escape closes, and the page behind must not scroll while it is open.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [onClose]);

  return createPortal(
    <div
      aria-label={alt}
      aria-modal="true"
      className="fixed inset-0 z-100 flex flex-col bg-background/95 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
    >
      <div className="flex justify-end p-4">
        <button
          aria-label="Close photo"
          className="grid size-10 place-items-center border border-border bg-card text-foreground transition-colors hover:bg-accent"
          onClick={onClose}
          type="button"
        >
          <X className="size-5" />
        </button>
      </div>
      <div className="flex min-h-0 flex-1 items-center justify-center px-4 pb-4">
        {/* Contained, not cropped: the whole photo matters here. */}
        <div className="relative h-full w-full max-w-3xl">
          <Image
            alt={alt}
            className="object-contain"
            fill
            sizes="(max-width: 768px) 100vw, 768px"
            src={url}
          />
        </div>
      </div>
      <p className="pb-6 text-center text-sm text-muted-foreground">{alt}</p>
    </div>,
    document.body,
  );
}

/**
 * Wraps an avatar so clicking it opens the photo full screen. With no photo
 * it renders the child untouched - there is nothing to enlarge, and a
 * button that does nothing is worse than no button.
 */
export function PhotoViewerTrigger({
  children,
  name,
  url,
}: {
  children: React.ReactNode;
  name: string;
  url?: null | string;
}) {
  const [open, setOpen] = useState(false);
  if (!url) return children;

  return (
    <>
      <button
        aria-label={`View ${name}'s photo full screen`}
        className="group relative shrink-0 cursor-zoom-in rounded-full outline-ring/50 focus-visible:ring-2 focus-visible:ring-ring"
        onClick={() => {
          setOpen(true);
        }}
        title={`View ${name}'s photo`}
        type="button"
      >
        {children}
        <span className="pointer-events-none absolute inset-0 grid place-items-center rounded-full bg-foreground/50 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
          <ZoomIn className="size-4 text-background" />
        </span>
      </button>
      {open && (
        <Overlay
          alt={name}
          onClose={() => {
            setOpen(false);
          }}
          url={url}
        />
      )}
    </>
  );
}
