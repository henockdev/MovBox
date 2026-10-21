import { NextRequest, NextResponse } from "next/server";
import { getBoxmoviesAnime } from "@/lib/data";

export const revalidate = 600; // 10 min

/**
 * /api/anime â€” drives boxmovies's /animated-series page via the h5-api
 * /home endpoint, then filters to animation/anime sections.
 *
 * Returns a flat `items` array for the browse grid + `sections` for the
 * hero/featured row.
 */
export async function GET(_req: NextRequest) {
  try {
    const data = await getBoxmoviesAnime();
    return NextResponse.json(data, {
      headers: { "Cache-Control": "public, s-maxage=600, stale-while-revalidate=1200" },
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: { code: "anime_error", message: e?.message ?? "anime fetch failed" } },
      { status: 502 }
    );
  }
}
