"use client";

// One-time voting code handover: shown exactly once after accreditation for
// the accreditor to pass to the voter. Big, mono, copyable.
import { Copy } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";

export function VoteCodeDialog({
  code,
  onClose,
  voterName,
}: {
  code: null | string;
  onClose: () => void;
  voterName: string;
}) {
  return (
    <Modal
      description={`Hand this code to ${voterName}. It signs them in once and is not shown again.`}
      onClose={onClose}
      open={code !== null}
      title="One-time voting code"
    >
      <div className="space-y-4">
        <p className="rounded-xl border border-border bg-muted/40 px-4 py-6 text-center font-mono text-2xl font-semibold tracking-[0.2em] tabular-nums select-all">
          {code}
        </p>
        <div className="flex flex-wrap justify-end gap-2">
          <Button
            onClick={() => {
              if (code) {
                void navigator.clipboard.writeText(code);
                toast.success("Code copied");
              }
            }}
            type="button"
            variant="outline"
          >
            <Copy className="size-4" /> Copy
          </Button>
          <Button onClick={onClose} type="button" variant="brand">
            Done
          </Button>
        </div>
      </div>
    </Modal>
  );
}
