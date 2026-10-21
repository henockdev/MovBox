import { NextResponse } from "next/server";
import { getBoxmoviesHome } from "@/lib/data";

/**
 * GET /api/home
 *
 * Boxmovies-backed home. Returns the same themed sections boxmovies.org
 * shows on its home (Popular Series, Adult Animation, K-Drama, C-Drama,
 * etc.) plus a hero pool of featured items. The Movbox home page renders
 * these in our premium UI.
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const TIMEOUT_MS = 180_000;

export async function GET() {
  try {
    const home = await Promise.race([
      getBoxmoviesHome(),
      new Promise<never>((_, rej) =>
        setTimeout(() => rej(new Error("boxmovies home timed out")), TIMEOUT_MS)
      ),
    ]);
    return NextResponse.json(
      { ok: true, ...home },
      {
        headers: { "Cache-Control": "public, max-age=60, s-maxage=300" },
      }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.warn(`[api/home] failed: ${message}`);
    return NextResponse.json(
      { ok: false, error: message, sections: [], hero: [], count: 0 },
      { status: 504 }
    );
  }
}
