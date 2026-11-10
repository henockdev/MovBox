import { NextRequest, NextResponse } from "next/server";
import { getBoxmoviesRankings } from "@/lib/data";
import {
  pickRankingGroup,
  toSearchCards,
  trendingTermsFrom,
  type SearchCard,
  type SearchTabId,
} from "@/lib/search";

/**
 * GET /api/search-landing?tab=all|movie|tv|short
 *
 * The landing state of the search screen: the catalogue's own ranking (the
 * *Top rankings* rows) and the terms behind the *Everyone is searching* row.
 *
 * In the app that row is literally the titles of the ranking block — the
 * titles the whole catalogue is searching for right now — so the two come
 * from the same upstream call here too.
 *
 * This is a separate route so the header's search overlay can open on a
 * full screen without every page of the site paying for the ranking data.
 */

export const revalidate = 1800; // 30 min
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const tab = (searchParams.get("tab") ?? "all").toLowerCase() as SearchTabId;

  try {
    const groups = await getBoxmoviesRankings();
    const movieGroup = pickRankingGroup(groups, "movie");
    const tvGroup = pickRankingGroup(groups, "tv");
    const shortGroup =
      groups.find((g) => g.title.toLowerCase().includes("short")) ?? tvGroup;
    const allGroup = groups[0] ?? movieGroup ?? tvGroup;

    const byTab: Record<SearchTabId, SearchCard[]> = {
      all: toSearchCards(allGroup?.items ?? []).slice(0, 20),
      movie: toSearchCards(movieGroup?.items ?? []).slice(0, 20),
      tv: toSearchCards(tvGroup?.items ?? []).slice(0, 20),
      short: toSearchCards(shortGroup?.items ?? []).slice(0, 20),
    };

    const ranked = byTab[tab] ?? byTab.all;

    return NextResponse.json(
      {
        ok: true,
        tab,
        ranked,
        trending: trendingTermsFrom(ranked),
      },
      { headers: { "Cache-Control": "public, max-age=60, s-maxage=600" } }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.warn(`[api/search-landing] tab=${tab} failed: ${message}`);
    return NextResponse.json(
      { ok: false, error: message, ranked: [], trending: [] },
      { status: 200 }
    );
  }
}
