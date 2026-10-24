import { NextRequest, NextResponse } from "next/server";
import { searchBoxmovies } from "@/lib/data";

/**
 * GET /api/search?q=...&page=1&subjectType=0
 *
 * Full search across the boxmovies catalog. Drives the real
 * h5-api.aoneroom.com /wefeed-h5api-bff/subject/search endpoint (the
 * same one boxmovies's own /searchResult page uses), so the results
 * cover the entire boxmovies catalog — not just whatever the SPA DOM
 * happened to expose.
 *
 * `subjectType`:
 *   0 = all (default)
 *   1 = movies only
 *   2 = TV series only
 *   3 = music
 *
 * Response shape mirrors boxmovies's pager: { results, totalCount,
 * hasMore, nextPage, page, perPage, subjectType }.
 *
 * Cached at the edge for 60s — same query + page + filter reused
 * across users for the lifetime of the cache.
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const TIMEOUT_MS = 120_000;

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") ?? "").trim();
  const page = Number(searchParams.get("page") ?? 1) || 1;
  const perPage = Math.min(50, Number(searchParams.get("perPage") ?? 28) || 28);
  const subjectTypeRaw = Number(searchParams.get("subjectType") ?? 0);
  const subjectType = ([0, 1, 2, 3] as const).find((n) => n === subjectTypeRaw) ?? 0;

  if (!q) {
    return NextResponse.json(
      { ok: false, error: "Missing q", results: [] },
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
        ...j,
      },
      {
        headers: { "Cache-Control": "public, max-age=30, s-maxage=120" },
      }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.warn(`[api/search] ${q} page=${page} subjectType=${subjectType} failed: ${message}`);
    return NextResponse.json(
      { ok: false, error: message, results: [] },
      { status: 504 }
    );
  }
}
