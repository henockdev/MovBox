import { NextRequest, NextResponse } from "next/server";
import { suggestBoxmovies } from "@/lib/data";

/**
 * GET /api/search-suggest?q=...
 *
 * Quick typeahead for the search screen. Drives the same h5-api endpoint
 * the Android app drives — `POST /wefeed-h5api-bff/subject/search-suggest`
 * — and returns the words the upstream suggests for what has been typed.
 *
 * The upstream's suggest endpoint needs no bearer token (verified live on
 * 2026-11-09), so this stays fast and cannot fail on an expired session.
 *
 * Cached on the edge for 60s — typeahead is a per-keystroke call, but the
 * upstream answer does not change that often.
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") ?? "").trim();

  if (q.length < 2) {
    return NextResponse.json(
      { ok: true, query: q, suggestions: [] },
      { headers: { "Cache-Control": "public, max-age=30, s-maxage=60" } }
    );
  }

  try {
    const suggestions = await suggestBoxmovies(q);
    return NextResponse.json(
      { ok: true, query: q, suggestions },
      { headers: { "Cache-Control": "public, max-age=30, s-maxage=60" } }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.warn(`[api/search-suggest] ${q} failed: ${message}`);
    return NextResponse.json(
      { ok: false, error: message, suggestions: [] },
      { status: 200 }
    );
  }
}
