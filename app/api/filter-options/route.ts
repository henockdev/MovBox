import { NextRequest, NextResponse } from "next/server";
import { getBoxmoviesFilterOptions, type ChannelId } from "@/lib/data";

/**
 * GET /api/filter-options?channelId=1|2|7
 *
 * Returns the available filter chip values for a given channel
 * (genre / country / year / language / sort). Frontend uses this to
 * render the filter sidebar on /movies, /tv, /animations.
 *
 * Cached aggressively â€” these values rarely change.
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const rawCid = Number(searchParams.get("channelId") ?? 1);
  if (![1, 2, 7].includes(rawCid)) {
    return NextResponse.json(
      { ok: false, error: "channelId must be 1, 2, or 7" },
      { status: 400 }
    );
  }
  const channelId = rawCid as ChannelId;

  try {
    const options = await getBoxmoviesFilterOptions(channelId);
    return NextResponse.json(
      { ok: true, channelId, options },
      {
        headers: {
          "Cache-Control": "public, max-age=3600, s-maxage=86400",
        },
      }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.warn(`[api/filter-options] ch=${channelId} failed: ${message}`);
    return NextResponse.json(
      {
        ok: false,
        error: message,
        channelId,
        options: { genre: ["All"], country: ["All"], year: ["All"], language: ["All"], sort: ["ForYou"] },
      },
      { status: 504 }
    );
  }
}
