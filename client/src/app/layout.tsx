import type { Metadata, Viewport } from "next";

import { IBM_Plex_Mono, Poppins, Space_Grotesk } from "next/font/google";

import { BrandingProvider } from "@/components/brand/branding-provider";
import { SiteBackground } from "@/components/site-background";
import { ThemeProvider } from "@/components/theme-provider";
import { getServerBranding } from "@/lib/branding-server";
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

/**
 * The deployment's own identity, resolved on the server.
 *
 * The icons come from here rather than from src/app/icon.png: file-based
 * metadata OUTRANKS this object, so while those files existed an uploaded
 * favicon could never reach the tab. The platform's own marks moved to
 * /public and are the fallback, which is what they always were.
 */
export async function generateMetadata(): Promise<Metadata> {
  const branding = await getServerBranding();
  const name = branding?.name || siteConfig.name;
  const icon = branding?.faviconUrl ?? "/icon.png";

  return {
    alternates: { canonical: "/" },
    applicationName: name,
    authors: [{ name }],
    creator: name,
    description: siteConfig.description,
    icons: { apple: "/apple-icon.png", icon },
    keywords: [...siteConfig.keywords],
    metadataBase: new URL(siteUrl),
    openGraph: {
      description: siteConfig.description,
      locale: siteConfig.locale,
      siteName: name,
      title: siteConfig.title,
      type: "website",
      url: "/",
    },
    publisher: name,
    robots: {
      follow: true,
      googleBot: { follow: true, index: true, "max-image-preview": "large" },
      index: true,
    },
    title: {
      default: branding?.name ? `${name} · Elections` : siteConfig.title,
      template: `%s · ${name}`,
    },
    twitter: {
      card: "summary_large_image",
      description: siteConfig.description,
      title: siteConfig.title,
    },
  };
}

export const viewport: Viewport = {
  themeColor: siteConfig.themeColor,
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // Resolved once per render and shared by the metadata above: both come out
  // of the same cached fetch, so this costs no second round trip.
  const branding = await getServerBranding();

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
          <ReduxProvider>
            <BrandingProvider branding={branding}>{children}</BrandingProvider>
          </ReduxProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
