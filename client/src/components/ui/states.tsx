import { AlertCircle, Inbox } from "lucide-react";
import * as React from "react";

import { BackButton } from "@/components/ui/back-button";
import { cn } from "@/lib/utils";

export function EmptyState({
  action,
  description,
  icon: Icon = Inbox,
  title,
}: {
  action?: React.ReactNode;
  description?: string;
  icon?: React.ComponentType<{ className?: string }>;
  title: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 border border-dashed border-border px-6 py-16 text-center">
      <span className="flex size-11 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Icon aria-hidden className="size-5" />
      </span>
      <div className="space-y-1">
        <p className="font-medium">{title}</p>
        {description && <p className="max-w-sm text-sm text-muted-foreground">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function ErrorState({ message }: { message?: string }) {
  return (
    <div
      className="flex items-center gap-3 border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive"
      role="alert"
    >
      <AlertCircle aria-hidden className="size-4 shrink-0" />
      <span>{message ?? "Failed to load. Please try again."}</span>
    </div>
  );
}

export function PageHeader({
  action,
  backHref,
  backLabel,
  className,
  description,
  title,
}: {
  action?: React.ReactNode;
  /** Set with backLabel to put a back arrow left of the title. */
  backHref?: string;
  backLabel?: string;
  className?: string;
  description?: string;
  title: string;
}) {
  return (
    <div className={cn("flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between", className)}>
      <div className="flex min-w-0 items-start gap-1.5">
        {backHref && backLabel && (
          // The negative top margin centres the 40px target on the title's
          // line box rather than on the whole title-plus-description block.
          <BackButton className="-mt-1 sm:-mt-0.5" href={backHref} label={backLabel} />
        )}
        <div className="min-w-0 flex-1 space-y-1">
          <h1 className="text-2xl font-semibold sm:text-3xl">{title}</h1>
          {description && (
            <p className="text-sm leading-relaxed text-muted-foreground">
              {description}
            </p>
          )}
        </div>
      </div>
      {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
    </div>
  );
}
