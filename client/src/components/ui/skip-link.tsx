/**
 * Keyboard bypass for whatever navigation precedes the main content. Hidden
 * until it takes focus, which makes it the first thing Tab reaches on the
 * page - without it a keyboard user walks the entire nav again on every
 * navigation.
 *
 * The target element needs a matching id and, if it is not natively
 * focusable, `tabIndex={-1}`, or the jump moves the viewport without moving
 * focus.
 */
export function SkipLink({
  children = "Skip to content",
  targetId,
}: {
  children?: React.ReactNode;
  targetId: string;
}) {
  return (
    <a
      className="sr-only z-50 focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:border-[1.6px] focus:border-foreground focus:bg-background focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-foreground focus:outline-none"
      href={`#${targetId}`}
    >
      {children}
    </a>
  );
}
