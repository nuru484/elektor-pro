"use client";

// Shared confirmation dialog (DMS pattern): destructive/critical actions ask
// before acting, and high-stakes ones can require typing an exact phrase.
import { useState } from "react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface ConfirmationDialogProps {
  cancelText?: string;
  confirmText?: string;
  description: string;
  isDestructive?: boolean;
  onConfirm: () => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  /** Require typing this exact phrase before Confirm enables. */
  requireExactMatch?: string;
  title: string;
}

export function ConfirmationDialog({
  cancelText = "Cancel",
  confirmText = "Confirm",
  description,
  isDestructive = false,
  onConfirm,
  onOpenChange,
  open,
  requireExactMatch,
  title,
}: ConfirmationDialogProps) {
  const [inputValue, setInputValue] = useState("");

  const handleOpenChange = (next: boolean) => {
    onOpenChange(next);
    if (!next) setInputValue("");
  };

  const confirmDisabled = requireExactMatch ? inputValue !== requireExactMatch : false;

  return (
    <AlertDialog onOpenChange={handleOpenChange} open={open}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>

        {requireExactMatch && (
          <div className="space-y-2">
            <Label className="inline leading-relaxed" htmlFor="confirm-input">
              Type <span className="font-mono font-bold">{requireExactMatch}</span> to
              confirm:
            </Label>
            <Input
              className="font-mono"
              id="confirm-input"
              onChange={(e) => setInputValue(e.target.value)}
              placeholder={requireExactMatch}
              value={inputValue}
            />
          </div>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel>{cancelText}</AlertDialogCancel>
          <AlertDialogAction
            className={cn(
              isDestructive &&
                "bg-destructive text-white hover:bg-destructive/90 focus-visible:ring-destructive/40",
            )}
            disabled={confirmDisabled}
            onClick={onConfirm}
          >
            {confirmText}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
