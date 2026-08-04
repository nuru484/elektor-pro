import type { Metadata, Viewport } from "next";

import { Bodoni_Moda, Courier_Prime, Instrument_Sans } from "next/font/google";

import { SiteBackground } from "@/components/site-background";
import { ThemeProvider } from "@/components/theme-provider";
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
    // suppressHydrationWarning: next-themes stamps the theme class on <html>
    // before hydration.
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${instrument.variable} ${bodoni.variable} ${courier.variable} font-sans`}
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
