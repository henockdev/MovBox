import { ImageResponse } from "next/og";

/**
 * Root OpenGraph / Twitter / WhatsApp / Discord / Telegram / Slack /
 * iMessage card image. 1200×630 — the universal size every major
 * social platform accepts. When someone shares `movbox.xyz`, this
 * is the image that pops up in the preview.
 *
 * The static (brand-only) version lives in app/opengraph-image.tsx
 * — Next.js exposes it as `/opengraph-image` automatically. Per-page
 * variants (e.g. movie detail) override this in their own
 * `opengraph-image.tsx`.
 */
export const runtime = "nodejs";
export const alt = "Movbox — stream the latest movies and TV in 4K";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const BRAND = "#800020"; // burgundy
const CREAM = "#f3ede4";
const ACCENT = "#c4943b"; // gold
const BG = "#0a0807";

export default async function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: BG,
          color: CREAM,
          fontFamily: "sans-serif",
          padding: "60px",
          position: "relative",
        }}
      >
        {/* Soft glow in the corners — pure radial gradient */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: `radial-gradient(circle at 12% 18%, ${ACCENT}33, transparent 45%), radial-gradient(circle at 88% 82%, ${BRAND}55, transparent 50%)`,
          }}
        />
        {/* Brand mark + wordmark */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 18,
            position: "relative",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 60,
              height: 60,
              borderRadius: 14,
              background: `linear-gradient(135deg, ${ACCENT}, ${BRAND})`,
              fontSize: 32,
              fontWeight: 800,
              color: CREAM,
            }}
          >
            M
          </div>
          <div style={{ fontSize: 36, fontWeight: 700, letterSpacing: -1 }}>movbox</div>
        </div>
        {/* Headline */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            position: "relative",
            marginTop: "auto",
            marginBottom: "auto",
            maxWidth: 900,
          }}
        >
          <div
            style={{
              fontSize: 72,
              fontWeight: 800,
              lineHeight: 1.05,
              letterSpacing: -2,
              color: CREAM,
            }}
          >
            Stream the latest movies and TV in 4K Ultra HD.
          </div>
          <div
            style={{
              marginTop: 24,
              fontSize: 30,
              fontWeight: 500,
              color: "#a89a87",
            }}
          >
            Free · No signup · Works on any device
          </div>
        </div>
        {/* Bottom strip — domain + CTA */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            position: "relative",
            fontSize: 24,
            color: "#a89a87",
          }}
        >
          <div>movbox.xyz</div>
          <div
            style={{
              padding: "10px 22px",
              borderRadius: 999,
              background: ACCENT,
              color: BG,
              fontWeight: 700,
            }}
          >
            Watch free →
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
