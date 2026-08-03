"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cn("text-sm font-medium leading-none text-foreground", className)}
      {...props}
    />
  );
}

/**
 * Label + control + hint/error. The label is wired to the control: a single
 * element child gets an auto-generated id (unless it already has one) and the
 * label's htmlFor points at it, so clicking the label focuses the field and
 * assistive tech announces it.
 */
export function Field({
  children,
  error,
  hint,
  label,
}: {
  children: React.ReactNode;
  error?: string;
  hint?: string;
  label?: string;
}) {
  const autoId = React.useId();

  let control = children;
  let controlId: string | undefined;
  if (React.isValidElement(children)) {
    const existingId = (children.props as { id?: string }).id;
    controlId = existingId ?? autoId;
    if (!existingId) {
      control = React.cloneElement(children as React.ReactElement<{ id?: string }>, {
        id: controlId,
      });
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      {label && <Label htmlFor={controlId}>{label}</Label>}
      {control}
      {hint && !error && <p className="text-xs text-muted-foreground">{hint}</p>}
      {error && <p className="text-xs font-medium text-destructive">{error}</p>}
    </div>
  );
}
