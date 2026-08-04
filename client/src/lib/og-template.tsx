// src/lib/og-template.tsx
//
// Shared brand template for Open Graph cards: deep-blue accent rule on the
// dark field, wordmark, page-specific text. Satori (behind ImageResponse)
// supports only flexbox + a CSS subset, so the layout stays flex-based.
import { ImageResponse } from "next/og";

export const OG_SIZE = { height: 630, width: 1200 } as const;
export const OG_CONTENT_TYPE = "image/png";

const FIELD = "#171c28";
const INK = "#f5f6f9";
const MUTED = "#9aa3b4";
const ACCENT = "#2f5fd0";

export function brandOgImage({
  eyebrow,
  subtitle,
  title,
}: {
  eyebrow: string;
  subtitle: string;
  title: string;
}) {
  const titleSize = title.length > 30 ? 64 : 88;

  return new ImageResponse(
    (
      <div
        style={{
          background: FIELD,
          borderTop: `16px solid ${ACCENT}`,
          color: INK,
          display: "flex",
          flexDirection: "column",
          height: "100%",
          justifyContent: "space-between",
          padding: "64px 80px",
          width: "100%",
        }}
      >
        <div style={{ color: MUTED, display: "flex", fontSize: 30 }}>{eyebrow}</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div style={{ fontSize: titleSize, fontWeight: 700, lineHeight: 1.05 }}>{title}</div>
          <div style={{ color: MUTED, fontSize: 34 }}>{subtitle}</div>
        </div>
        <div style={{ alignItems: "center", display: "flex", justifyContent: "space-between" }}>
          <div style={{ display: "flex", fontSize: 34, fontWeight: 700 }}>
            Elektor<span style={{ color: ACCENT }}>Pro</span>
          </div>
          <div style={{ color: MUTED, display: "flex", fontSize: 26 }}>
            Every ballot secret · every result provable
          </div>
        </div>
      </div>
    ),
    OG_SIZE,
  );
}
