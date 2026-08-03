"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";

/** Class-based dark mode (`.dark` on <html>), following the system by default. */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      {children}
    </NextThemesProvider>
  );
}
