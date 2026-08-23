"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

export function Label({
  className,
  ...props
}: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cn(
        "text-sm font-medium leading-none text-foreground",
        className,
      )}
      {...props}
    />
  );
}

/**
 * Label + control + hint/error.
 *
 * The label is wired to the control: a single element child gets an
 * auto-generated id (unless it already has one) and the label's htmlFor
 * points at it, so clicking the label focuses the field.
 *
 * The hint and the error are wired the same way, through aria-describedby, so
 * a screen reader reaching the input hears why it is invalid instead of just
 * "invalid entry" - or, without the wiring, nothing at all. The error also
 * carries role="alert", which is what announces it at the moment validation
 * puts it on screen rather than only when focus next lands on the field.
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
  const hintId = `${autoId}-hint`;
  const errorId = `${autoId}-error`;

  const showHint = Boolean(hint) && !error;
  const describedBy =
    [error ? errorId : null, showHint ? hintId : null]
      .filter(Boolean)
      .join(" ") || undefined;

  let control = children;
  let controlId: string | undefined;
  if (React.isValidElement(children)) {
    const childProps = children.props as {
      "aria-describedby"?: string;
      id?: string;
    };
    const existingId = childProps.id;
    controlId = existingId ?? autoId;
    // Keep any describedby the caller already set - dropping it would break
    // controls that point at their own supplementary copy.
    const mergedDescribedBy =
      [childProps["aria-describedby"], describedBy].filter(Boolean).join(" ") ||
      undefined;

    control = React.cloneElement(
      children as React.ReactElement<{
        "aria-describedby"?: string;
        "aria-invalid"?: boolean;
        id?: string;
      }>,
      {
        "aria-describedby": mergedDescribedBy,
        "aria-invalid": error ? true : undefined,
        ...(existingId ? {} : { id: controlId }),
      },
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      {label && <Label htmlFor={controlId}>{label}</Label>}
      {control}
      {showHint && (
        <p className="text-xs text-muted-foreground" id={hintId}>
          {hint}
        </p>
      )}
      {error && (
        <p
          className="text-xs font-medium text-destructive"
          id={errorId}
          role="alert"
        >
          {error}
        </p>
      )}
    </div>
  );
}
