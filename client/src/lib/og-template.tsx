// src/lib/og-template.tsx
//
// Shared brand template for Open Graph cards: forest-green accent rule on the
// dark field, the ballot-box mark + wordmark, page-specific text. Satori
// (behind ImageResponse) supports only flexbox + a CSS subset, so the layout
// stays flex-based. The mark is read from public/ and inlined as a data URI -
// satori cannot fetch relative URLs at render time.
import { readFile } from "node:fs/promises";
import path from "node:path";

import { ImageResponse } from "next/og";

export const OG_SIZE = { height: 630, width: 1200 } as const;
export const OG_CONTENT_TYPE = "image/png";

const FIELD = "#161d17";
const INK = "#f5f3ee";
const MUTED = "#a3a69c";
const ACCENT = "#51b67a";

const loadMark = async (): Promise<string> => {
  const file = await readFile(
    path.join(process.cwd(), "public", "logo-mark.png"),
  );
  return `data:image/png;base64,${file.toString("base64")}`;
};

export async function brandOgImage({
  eyebrow,
  subtitle,
  title,
}: {
  eyebrow: string;
  subtitle: string;
  title: string;
}) {
  const titleSize = title.length > 30 ? 64 : 88;
  const mark = await loadMark();

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
          <div style={{ alignItems: "center", display: "flex", gap: 18 }}>
            {/* eslint-disable-next-line @next/next/no-img-element -- satori renders plain img */}
            <img alt="" height={72} src={mark} width={72} />
            <div style={{ display: "flex", fontSize: 34, fontWeight: 700 }}>
              Elektor<span style={{ color: ACCENT }}>Pro</span>
            </div>
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
