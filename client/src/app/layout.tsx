import type { Metadata, Viewport } from "next";

import { Geist_Mono, Plus_Jakarta_Sans } from "next/font/google";

import { SiteBackground } from "@/components/site-background";
import { siteConfig, siteUrl } from "@/lib/site";
import { ReduxProvider } from "@/redux/provider";

import "./globals.css";

const jakarta = Plus_Jakarta_Sans({
  display: "swap",
  subsets: ["latin"],
  variable: "--font-app",
});
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono" });

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
      <body className={`${jakarta.variable} ${geistMono.variable} font-sans`}>
        <SiteBackground />
        <ReduxProvider>{children}</ReduxProvider>
      </body>
    </html>
  );
}
