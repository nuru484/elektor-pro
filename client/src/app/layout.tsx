import type { Metadata } from "next";

import { Geist, Geist_Mono } from "next/font/google";

import { ReduxProvider } from "@/redux/provider";

import "./globals.css";

const geistSans = Geist({ subsets: ["latin"], variable: "--font-geist-sans" });
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
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} font-sans`}>
        <ReduxProvider>{children}</ReduxProvider>
      </body>
    </html>
  );
}
