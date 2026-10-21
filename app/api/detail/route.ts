import { NextRequest, NextResponse } from "next/server";
import { getBoxmoviesDetail } from "@/lib/data";

/**
 * GET /api/detail?detailPath=...
 *
 * Returns the full boxmovies detail (title, synopsis, year, genres,
 * country, duration, seasons, etc.). Used by the watch page server
 * component to render the metadata block.
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const TIMEOUT_MS = 120_000;

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const detailPath = searchParams.get("detailPath");
  if (!detailPath) {
    return NextResponse.json(
      { ok: false, error: "Missing detailPath" },
      { status: 400 }
    );
  }
  try {
    const details = await Promise.race([
      getBoxmoviesDetail(detailPath),
      new Promise<null>((_, rej) =>
        setTimeout(() => rej(new Error("boxmovies detail timed out")), TIMEOUT_MS)
      ),
    ]);
    if (!details) {
      return NextResponse.json(
        { ok: false, error: "Detail not found", detailPath },
        { status: 404 }
      );
    }
    return NextResponse.json(
      { ok: true, details },
      {
        headers: { "Cache-Control": "public, max-age=300, s-maxage=3600" },
      }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.warn(`[api/detail] ${detailPath} failed: ${message}`);
    return NextResponse.json(
      { ok: false, error: message, detailPath },
      { status: 504 }
    );
  }
}
