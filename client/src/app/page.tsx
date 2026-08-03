import type { Metadata } from "next";

import { Cta } from "@/components/landing/cta";
import { Faq } from "@/components/landing/faq";
import { Features } from "@/components/landing/features";
import { Hero } from "@/components/landing/hero";
import { HowItWorks } from "@/components/landing/how-it-works";
import { Security } from "@/components/landing/security";
import { SiteFooter } from "@/components/landing/site-footer";
import { SiteHeader } from "@/components/landing/site-header";
import { UseCases } from "@/components/landing/use-cases";

export const metadata: Metadata = {
  description:
    "Elektor Pro runs secure elections end to end for universities, unions, associations, and companies - secret ballots, live results, and outcomes everyone can verify.",
  title: "Elektor Pro - Run elections everyone trusts",
};

export default function Home() {
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />
      <main className="flex-1">
        <Hero />
        <Features />
        <HowItWorks />
        <Security />
        <UseCases />
        <Faq />
        <Cta />
      </main>
      <SiteFooter />
    </div>
  );
}
