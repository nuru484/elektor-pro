// src/components/site-background.tsx

/**
 * Fixed, full-viewport ambient background for the public site (dotted grid +
 * soft radial glows + vertical fade). Purely decorative - see
 * `.site-background` in globals.css. Console layouts paint an opaque surface
 * over it, so it is visible on public pages only.
 */
export function SiteBackground() {
  return <div aria-hidden className="site-background" />;
}
