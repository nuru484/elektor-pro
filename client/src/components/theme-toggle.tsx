"use client";

// Light/dark switch, hydration-safe: renders a blank slot until mounted so
// the server and first client render agree, then swaps in the right icon.
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";

import { Button } from "@/components/ui/button";

const emptySubscribe = () => () => {
  // Mount state never changes after hydration.
};

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );

  if (!mounted) return <span aria-hidden className="size-8" />;

  const isDark = resolvedTheme === "dark";
  return (
    <Button
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      onClick={() => setTheme(isDark ? "light" : "dark")}
      size="icon-sm"
      variant="ghost"
    >
      {isDark ? <Sun className="size-5" /> : <Moon className="size-5" />}
    </Button>
  );
}
