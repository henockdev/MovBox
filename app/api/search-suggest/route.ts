import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/search-suggest?q=...
 *
 * Quick typeahead for the header search bar. Drives the same h5-api
 * endpoint boxmovies's own typeahead uses
 * (POST /wefeed-h5api-bff/subject/search-suggest). Returns up to 10
 * keyword strings the user can pick from.
 *
 * Cached on the edge for 30s — typeahead is a per-keystroke call but
 * the upstream result doesn't change that often.
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const BOX_BASE =
  process.env.BOXMOVIES_API ??
  process.env.NEXT_PUBLIC_BOXMOVIES_API ??
  "http://localhost:4000";

const TIMEOUT_MS = 30_000;

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") ?? "").trim();
  if (!q) {
    return NextResponse.json(
      { ok: false, error: "Missing q", results: [] },
      { status: 400 }
    );
  }
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(
      `${BOX_BASE}/searchSuggest?q=${encodeURIComponent(q)}`,
      {
        signal: controller.signal,
        headers: { Accept: "application/json" },
        cache: "no-store",
      }
    );
    const j = await res.json();
    return NextResponse.json(j, {
      headers: { "Cache-Control": "public, max-age=30, s-maxage=60" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { ok: false, error: message, results: [] },
      { status: 504 }
    );
  } finally {
    clearTimeout(t);
  }
}
