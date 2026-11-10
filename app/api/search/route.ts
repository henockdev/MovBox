import { NextRequest, NextResponse } from "next/server";
import { searchBoxmovies } from "@/lib/data";
import { tabSubjectType, toSearchCard } from "@/lib/search";

/**
 * GET /api/search?q=...&tab=all|movie|tv|short&page=1
 *
 * Full search across the boxmovies catalog. Drives the real
 * h5-api.aoneroom.com /wefeed-h5api-bff/subject/search endpoint (the
 * same one boxmovies's own /searchResult page uses), so the results
 * cover the entire boxmovies catalog — not just whatever the SPA DOM
 * happened to expose.
 *
 * `tab` is the app's catalogue filter and maps onto the upstream's
 * `subjectType`:
 *
 *   all   → 0  everything
 *   movie → 1  films
 *   tv    → 2  series
 *   short → 5  short TV (episodic shorts)
 *
 * The upstream honours `subjectType` and NOTHING else — measured on
 * 2026-11-09, `filters.yearMin`, `genres`, `country`, `language` and
 * `sort` all leave the result set byte-identical. The genre / year /
 * country / rating filters therefore run in the browser over the titles
 * this endpoint really returns (lib/search.ts).
 *
 * Response: { ok, query, tab, items, pager: { page, perPage, hasMore,
 * nextPage, totalCount } }.
 *
 * Cached at the edge for 60s — same query + page + tab reused across
 * users for the lifetime of the cache.
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const TIMEOUT_MS = 120_000;
const PER_PAGE = 28;

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") ?? "").trim();
  const tab = searchParams.get("tab") ?? "all";
  const page = Number(searchParams.get("page") ?? 1) || 1;
  const perPage = Math.min(50, Number(searchParams.get("perPage") ?? PER_PAGE) || PER_PAGE);
  const subjectType = tabSubjectType(tab);

  if (!q) {
    return NextResponse.json(
      { ok: false, error: "Missing q", items: [] },
      { status: 400 }
    );
  }

  try {
    const j = await Promise.race([
      searchBoxmovies(q, { page, perPage, subjectType }),
      new Promise<never>((_, rej) =>
        setTimeout(() => rej(new Error("boxmovies search timed out")), TIMEOUT_MS)
      ),
    ]);
    return NextResponse.json(
      {
        ok: true,
        query: q,
        tab,
        items: j.results.map(toSearchCard),
        pager: {
          page: j.page,
          perPage: j.perPage,
          hasMore: j.hasMore,
          nextPage: j.nextPage,
          totalCount: j.totalCount,
        },
      },
      {
        headers: { "Cache-Control": "public, max-age=30, s-maxage=120" },
      }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.warn(`[api/search] ${q} page=${page} tab=${tab} failed: ${message}`);
    return NextResponse.json(
      { ok: false, error: message, items: [] },
      { status: 504 }
    );
  }
}
