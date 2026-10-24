import { NextRequest, NextResponse } from "next/server";
import { getBoxmoviesBrowse, type ChannelId } from "@/lib/data";

/**
 * GET /api/browse?channelId=1|2|7&genre=&country=&year=&language=&sort=&page=&perPage=
 *
 * Filterable list endpoint. Drives the /movies, /tv, /animations pages.
 * Wraps boxmovies-api /browse which in turn drives h5-api.aoneroom.com
 * /wefeed-h5api-bff/subject/filter — the same endpoint boxmovies.org uses.
 *
 * All filter values are "All" or empty to skip a filter. sort defaults
 * to "ForYou" (the boxmovies "recommended for you" order).
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const TIMEOUT_MS = 120_000;

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const rawCid = Number(searchParams.get("channelId") ?? 1);
  if (![1, 2, 7].includes(rawCid)) {
    return NextResponse.json(
      { ok: false, error: "channelId must be 1 (movies), 2 (tv), or 7 (animation)" },
      { status: 400 }
    );
  }
  const channelId = rawCid as ChannelId;

  const filters = {
    genre: searchParams.get("genre") || undefined,
    country: searchParams.get("country") || undefined,
    year: searchParams.get("year") || undefined,
    language: searchParams.get("language") || undefined,
    sort: searchParams.get("sort") || "ForYou",
    page: Math.max(1, Number(searchParams.get("page") ?? 1)),
    perPage: Math.min(50, Math.max(1, Number(searchParams.get("perPage") ?? 28))),
  };

  try {
    const result = await Promise.race([
      getBoxmoviesBrowse(channelId, filters),
      new Promise<never>((_, rej) =>
        setTimeout(() => rej(new Error("browse timed out")), TIMEOUT_MS)
      ),
    ]);
    return NextResponse.json(
      { ok: true, ...result },
      {
        headers: {
          // Filter pages re-fetch on every chip change so keep this short.
          "Cache-Control": "public, max-age=30, s-maxage=120",
        },
      }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.warn(`[api/browse] ch=${channelId} failed: ${message}`);
    return NextResponse.json(
      {
        ok: false,
        error: message,
        items: [],
        hasMore: false,
        nextPage: null,
        page: filters.page,
        perPage: filters.perPage,
        channelId,
      },
      { status: 504 }
    );
  }
}
