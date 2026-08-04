"use client";

// DMS-style row actions: a vertical three-dot trigger opening a dropdown of
// actions. Every data table's Actions column renders this - actions never
// sit on the row as bare icon buttons.
import { MoreVertical } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function RowActionsMenu({
  children,
  label = "Row actions",
}: {
  /** DropdownMenuItem elements. */
  children: React.ReactNode;
  label?: string;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button aria-label={label} size="icon-sm" variant="ghost">
          <MoreVertical className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        {children}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
