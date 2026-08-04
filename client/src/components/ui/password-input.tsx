"use client";

import { Eye, EyeOff } from "lucide-react";
import { useState } from "react";

import { cn } from "@/lib/utils";

import { Input } from "./input";

/**
 * A password field with a show/hide toggle so users can check what they
 * typed - essential on mobile keyboards and for one-shot flows like the
 * forced first-login password change.
 */
export function PasswordInput({
  className,
  ...props
}: Omit<React.ComponentProps<typeof Input>, "type">) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <Input
        {...props}
        className={cn("pr-10", className)}
        type={visible ? "text" : "password"}
      />
      <button
        aria-label={visible ? "Hide password" : "Show password"}
        className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-muted-foreground hover:text-foreground"
        onClick={() => {
          setVisible((prev) => !prev);
        }}
        tabIndex={-1}
        title={visible ? "Hide password" : "Show password"}
        type="button"
      >
        {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
    </div>
  );
}
