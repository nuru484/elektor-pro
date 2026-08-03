import type { Metadata } from "next";

import { Geist_Mono, Urbanist } from "next/font/google";

import { SiteBackground } from "@/components/site-background";
import { ThemeProvider } from "@/components/theme/theme-provider";
import { ReduxProvider } from "@/redux/provider";

import "./globals.css";

const urbanist = Urbanist({ display: "swap", subsets: ["latin"], variable: "--font-urbanist" });
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono" });

export const metadata: Metadata = {
  description:
    "A secure, customizable e-voting platform for organizations — secret ballots, real-time results, and a verifiable audit trail.",
  title: "Elektor Pro — Secure elections for any organization",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    // suppressHydrationWarning: next-themes mutates the <html> class before
    // hydration to apply the persisted/system theme.
    <html lang="en" suppressHydrationWarning>
      <body className={`${urbanist.variable} ${geistMono.variable} font-sans`}>
        <ThemeProvider>
          <SiteBackground />
          <ReduxProvider>{children}</ReduxProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
