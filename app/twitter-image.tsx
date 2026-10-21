import { ImageResponse } from "next/og";

/** Smaller, square crop that Twitter's in-feed preview favors. */
export const runtime = "nodejs";
export const alt = "Movbox — stream the latest movies and TV in 4K";
export const size = { width: 1200, height: 600 };
export const contentType = "image/png";

const BRAND = "#800020";
const CREAM = "#f3ede4";
const ACCENT = "#c4943b";
const BG = "#0a0807";

export default async function TwitterImage() {
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
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: `radial-gradient(circle at 88% 18%, ${ACCENT}33, transparent 45%), radial-gradient(circle at 12% 82%, ${BRAND}55, transparent 50%)`,
          }}
        />
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
              fontSize: 68,
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
              marginTop: 22,
              fontSize: 28,
              fontWeight: 500,
              color: "#a89a87",
            }}
          >
            Free · No signup · Works on any device
          </div>
        </div>
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
