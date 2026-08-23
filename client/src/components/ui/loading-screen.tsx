import Image from "next/image";

/**
 * Full-screen generic loading state - the logo mark inside a single spinner
 * ring on the flat surface. Used wherever a purpose-built skeleton doesn't
 * exist (e.g. the console shell while the session is being resolved). Kept
 * deliberately plain to match the rest of the UI.
 */
export function LoadingScreen() {
  return (
    <div
      aria-live="polite"
      className="flex min-h-dvh items-center justify-center bg-background px-6"
      role="status"
    >
      <div className="flex flex-col items-center gap-8">
        <div className="relative grid size-24 place-items-center">
          <div className="absolute inset-0 rounded-full border-2 border-brand/20 border-t-brand motion-safe:animate-spin" />
          <Image
            alt=""
            className="size-12 object-contain"
            height={48}
            priority
            src="/logo-mark.png"
            width={48}
          />
        </div>
        <p className="text-sm text-muted-foreground">Loading, please wait…</p>
      </div>
    </div>
  );
}
