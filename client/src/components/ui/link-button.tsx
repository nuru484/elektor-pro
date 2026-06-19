import Link from "next/link";

import { cn } from "@/lib/utils";
import { buttonVariants } from "./button";
import type { VariantProps } from "class-variance-authority";

export function LinkButton({
  children,
  className,
  href,
  size,
  variant,
  ...props
}: {
  children: React.ReactNode;
  className?: string;
  href: string;
} & VariantProps<typeof buttonVariants> &
  Omit<React.ComponentProps<typeof Link>, "className" | "href">) {
  return (
    <Link className={cn(buttonVariants({ size, variant }), className)} href={href} {...props}>
      {children}
    </Link>
  );
}
