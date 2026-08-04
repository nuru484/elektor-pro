import { brandOgImage, OG_CONTENT_TYPE, OG_SIZE } from "@/lib/og-template";

export const alt = "Elektor Pro - run elections everyone trusts";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function OpengraphImage() {
  return brandOgImage({
    eyebrow: "Secure e-voting for organizations",
    subtitle: "Secret ballots · live results · verifiable outcomes",
    title: "Run elections everyone trusts",
  });
}
