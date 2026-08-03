"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";

import { Button } from "@/components/ui/button";

const emptySubscribe = () => () => {
  // No store to subscribe to - hydration status never changes back.
};

/** False during SSR/hydration, true after - without a setState-in-effect. */
const useHydrated = () =>
  useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );

/**
 * Light/dark toggle. Renders a neutral placeholder until hydrated so the icon
 * never mismatches between server render and the client's resolved theme.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();
  const hydrated = useHydrated();

  const isDark = resolvedTheme === "dark";

  return (
    <Button
      aria-label={hydrated ? (isDark ? "Switch to light mode" : "Switch to dark mode") : "Toggle theme"}
      className={className}
      onClick={() => setTheme(isDark ? "light" : "dark")}
      size="icon-sm"
      type="button"
      variant="ghost"
    >
      {hydrated && isDark ? <Sun className="size-4" /> : <Moon className="size-4" />}
    </Button>
  );
}
