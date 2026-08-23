import type { Metadata, Viewport } from "next";

import { IBM_Plex_Mono, Poppins, Space_Grotesk } from "next/font/google";

import { SiteBackground } from "@/components/site-background";
import { ThemeProvider } from "@/components/theme-provider";
import { siteConfig, siteUrl } from "@/lib/site";
import { ReduxProvider } from "@/redux/provider";

import "./globals.css";

// Grotesque type system: Space Grotesk carries every heading - it holds its
// shape at the display sizes the marketing pages run at - Poppins carries
// body and UI, and IBM Plex Mono carries serials, codes and counts.
const poppins = Poppins({
  display: "swap",
  subsets: ["latin"],
  variable: "--font-app",
  weight: ["300", "400", "500", "600", "700"],
});
const spaceGrotesk = Space_Grotesk({
  display: "swap",
  subsets: ["latin"],
  variable: "--font-display-app",
  weight: ["400", "500", "600", "700"],
});
const plexMono = IBM_Plex_Mono({
  display: "swap",
  subsets: ["latin"],
  variable: "--font-mono-app",
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  alternates: { canonical: "/" },
  applicationName: siteConfig.name,
  authors: [{ name: siteConfig.name }],
  creator: siteConfig.name,
  description: siteConfig.description,
  // Favicon/touch icons come from the src/app/icon.png + apple-icon.png file
  // conventions (generated from public/elektor-pro-logo.png).
  keywords: [...siteConfig.keywords],
  metadataBase: new URL(siteUrl),
  openGraph: {
    description: siteConfig.description,
    locale: siteConfig.locale,
    siteName: siteConfig.name,
    title: siteConfig.title,
    type: "website",
    url: "/",
  },
  publisher: siteConfig.name,
  robots: {
    follow: true,
    googleBot: { follow: true, index: true, "max-image-preview": "large" },
    index: true,
  },
  title: {
    default: siteConfig.title,
    template: `%s · ${siteConfig.name}`,
  },
  twitter: {
    card: "summary_large_image",
    description: siteConfig.description,
    title: siteConfig.title,
  },
};

export const viewport: Viewport = {
  themeColor: siteConfig.themeColor,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    // suppressHydrationWarning: next-themes stamps the theme class on <html>
    // before hydration.
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${poppins.variable} ${spaceGrotesk.variable} ${plexMono.variable} font-sans`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          disableTransitionOnChange
          enableSystem
        >
          <SiteBackground />
          <ReduxProvider>{children}</ReduxProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
