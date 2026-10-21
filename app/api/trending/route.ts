import { NextRequest, NextResponse } from "next/server";
import { getBoxmoviesTrending } from "@/lib/data";

/**
 * GET /api/trending?perPage=18
 *
 * Boxmovies-backed trending list. Used by the home hero carousel and
 * any "trending" page section.
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const TIMEOUT_MS = 120_000;

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const perPage = Number(searchParams.get("perPage") ?? 18) || 18;
  try {
    const j = await Promise.race([
      getBoxmoviesTrending(perPage),
      new Promise<never>((_, rej) =>
        setTimeout(() => rej(new Error("boxmovies trending timed out")), TIMEOUT_MS)
      ),
    ]);
    return NextResponse.json(
      { ok: true, results: j.results ?? [] },
      {
        headers: { "Cache-Control": "public, max-age=60, s-maxage=300" },
      }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.warn(`[api/trending] failed: ${message}`);
    return NextResponse.json(
      { ok: false, error: message, results: [] },
      { status: 504 }
    );
  }
}
