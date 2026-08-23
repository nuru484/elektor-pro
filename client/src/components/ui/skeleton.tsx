import { cn } from "@/lib/utils"

/**
 * A placeholder block. Tinted from the foreground rather than a surface token
 * so it steps the same distance off the page in both themes - `accent` sits
 * close enough to white that the shapes barely read in light mode.
 *
 * Compose these into a shape that matches the content being waited on; the
 * console's are in components/console/skeletons.tsx.
 */
function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn("animate-pulse bg-foreground/10", className)}
      {...props}
    />
  )
}

export { Skeleton }
