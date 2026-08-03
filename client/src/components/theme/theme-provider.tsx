"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";

/** Class-based dark mode (`.dark` on <html>). Dark is the product default. */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider attribute="class" defaultTheme="dark" disableTransitionOnChange>
      {children}
    </NextThemesProvider>
  );
}
