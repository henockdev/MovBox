import { ImageResponse } from "next/og";
import { getBoxmoviesDetail } from "@/lib/data";

/**
 * Per-TV OpenGraph card. Same visual language as the movie variant
 * but adds the season count to the metadata strip.
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

export default async function TVOg({ params }: PageProps) {
  const { id } = await params;
  const details = await getBoxmoviesDetail(id).catch(() => null);
  if (!details) {
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
  const seasonLabel =
    details.seasons.length === 1
      ? "1 Season"
      : `${details.seasons.length} Seasons`;

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
                fontSize: 28,
                fontWeight: 700,
                color: ACCENT,
                letterSpacing: 1.5,
                textTransform: "uppercase",
                display: "flex",
              }}
            >
              TV Series
            </div>
            <div
              style={{
                fontSize: 80,
                fontWeight: 800,
                lineHeight: 1.05,
                letterSpacing: -2.5,
                color: CREAM,
                display: "flex",
                marginTop: 8,
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
                fontSize: 28,
                color: "#d8c9b3",
              }}
            >
              {year && <span>{year}</span>}
              <span>· {seasonLabel}</span>
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
