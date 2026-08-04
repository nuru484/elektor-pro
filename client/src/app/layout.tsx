import type { Metadata, Viewport } from "next";

import { Bodoni_Moda, Courier_Prime, Instrument_Sans } from "next/font/google";

import { SiteBackground } from "@/components/site-background";
import { siteConfig, siteUrl } from "@/lib/site";
import { ReduxProvider } from "@/redux/provider";

import "./globals.css";

// Editorial type system: Bodoni Moda for display headings (the "declaration"
// voice), Instrument Sans for body/UI, Courier Prime for serials, counts and
// micro-labels.
const instrument = Instrument_Sans({
  display: "swap",
  subsets: ["latin"],
  variable: "--font-app",
});
const bodoni = Bodoni_Moda({
  display: "swap",
  style: ["normal", "italic"],
  subsets: ["latin"],
  variable: "--font-display-app",
});
const courier = Courier_Prime({
  display: "swap",
  subsets: ["latin"],
  variable: "--font-mono-app",
  weight: ["400", "700"],
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
    // Dark-only product: the `dark` class stays on <html> permanently so
    // component-level dark: variants keep applying.
    <html className="dark" lang="en">
      <body
        className={`${instrument.variable} ${bodoni.variable} ${courier.variable} font-sans`}
      >
        <SiteBackground />
        <ReduxProvider>{children}</ReduxProvider>
      </body>
    </html>
  );
}
