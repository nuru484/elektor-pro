"use client";

// Shared confirmation dialog: destructive/critical actions ask
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
          <div className="min-w-0 space-y-2">
            {/* The phrase can be a worst-case name: wrap anywhere so the
                mono token never widens the dialog. */}
            <Label
              className="inline min-w-0 leading-relaxed [overflow-wrap:anywhere]"
              htmlFor="confirm-input"
            >
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
            disabled={confirmDisabled}
            onClick={onConfirm}
            variant={isDestructive ? "destructive" : "brand"}
          >
            {confirmText}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
