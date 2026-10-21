import { ImageResponse } from "next/og";
import { getBoxmoviesDetail } from "@/lib/data";

/**
 * Per-movie OpenGraph card. Renders the backdrop with a dark
 * gradient overlay, the title in display serif, and the rating +
 * year + a "Watch on Movbox" CTA. Reuses the same visual language
 * as the home hero so the link preview looks like an extension of
 * the site.
 */
export const runtime = "nodejs";
export const alt = "Watch on Movbox";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const BRAND = "#800020";
const CREAM = "#f3ede4";
const ACCENT = "#c4943b";
const BG = "#0a0807";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function MovieOg({ params }: PageProps) {
  const { id } = await params;
  const details = await getBoxmoviesDetail(id).catch(() => null);
  if (!details) {
    // Fall back to brand OG if the detail fetch fails (e.g. h5-api
    // rate-limited). Next.js will still serve a 1200x630 image.
    return new ImageResponse(
      (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            background: BG,
            color: CREAM,
            fontFamily: "sans-serif",
            padding: 60,
            alignItems: "center",
            justifyContent: "center",
            fontSize: 64,
            fontWeight: 700,
          }}
        >
          Movbox
        </div>
      ),
      { ...size }
    );
  }

  const backdrop = details.backdropUrl || details.posterUrl;
  const year = details.releaseDate
    ? String(details.releaseDate).slice(0, 4)
    : "";
  const rating =
    typeof details.rating === "number" && details.rating > 0
      ? details.rating.toFixed(1)
      : null;

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
          position: "relative",
        }}
      >
        {/* Backdrop */}
        {backdrop && (
          <img
            src={backdrop}
            alt=""
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
            }}
          />
        )}
        {/* Gradient overlay so the title is readable */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            background:
              "linear-gradient(180deg, rgba(10,8,7,0.45) 0%, rgba(10,8,7,0.9) 70%, rgba(10,8,7,0.95) 100%)",
          }}
        />
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            padding: 60,
            position: "relative",
            height: "100%",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 14,
              fontSize: 24,
              color: "#d8c9b3",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: 44,
                height: 44,
                borderRadius: 10,
                background: `linear-gradient(135deg, ${ACCENT}, ${BRAND})`,
                fontSize: 22,
                fontWeight: 800,
                color: CREAM,
              }}
            >
              M
            </div>
            <div>movbox</div>
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              marginTop: "auto",
              maxWidth: 1000,
            }}
          >
            <div
              style={{
                fontSize: 84,
                fontWeight: 800,
                lineHeight: 1.05,
                letterSpacing: -2.5,
                color: CREAM,
                display: "flex",
              }}
            >
              {details.title}
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 14,
                marginTop: 24,
                fontSize: 30,
                color: "#d8c9b3",
              }}
            >
              {year && <span>{year}</span>}
              {details.genres.slice(0, 2).map((g) => (
                <span key={g}>· {g}</span>
              ))}
              {rating && (
                <span
                  style={{
                    marginLeft: 8,
                    padding: "6px 14px",
                    borderRadius: 999,
                    background: ACCENT,
                    color: BG,
                    fontWeight: 800,
                    display: "flex",
                  }}
                >
                  ★ {rating}
                </span>
              )}
            </div>
            <div
              style={{
                marginTop: 30,
                display: "flex",
                alignItems: "center",
                gap: 16,
              }}
            >
              <div
                style={{
                  padding: "14px 28px",
                  borderRadius: 999,
                  background: ACCENT,
                  color: BG,
                  fontSize: 28,
                  fontWeight: 800,
                  display: "flex",
                }}
              >
                Watch free on Movbox →
              </div>
              <div style={{ fontSize: 22, color: "#a89a87" }}>movbox.xyz</div>
            </div>
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
