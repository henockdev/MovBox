import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/video-proxy?url=<encoded boxmovies video url>
 *
 * The boxmovies CDN (bcdnxw.hakunaymatata.com / pacdn.aoneroom.com / etc.)
 * serves MP4 streams with a signed URL. It enforces a Referer check —
 * when the browser loads the video directly, the browser auto-sends
 * `Referer: http://localhost:3000/...` (the page URL) and the CDN returns
 * 429 Too Many Requests. The CDN only honours requests that carry
 * `Referer: https://boxmovies.org/...`.
 *
 * So we proxy every video byte through this route. Our server fetches
 * the upstream with the right Referer, and the browser talks to us
 * (same-origin) so CORS and Referer are no longer a problem.
 *
 * Range requests are passed through end-to-end so seeking still works.
 *
 * Query params:
 *   url       (required) — fully qualified boxmovies resource URL
 *   referer   (optional) — override referer (defaults to boxmovies.org/movies/<slug>)
 *   detailPath (optional) — used to build a sensible default referer
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const ALLOWED_HOSTS = new Set([
  "bcdnxw.hakunaymatata.com",
  "pacdn.aoneroom.com",
  "macdn.aoneroom.com",
  "pbcdnw.aoneroom.com",
  "spa.aoneroom.com",
  "h5-api.aoneroom.com",
]);

const ALLOWED_PREFIX_HOSTS = [
  "bcdnxw.",
  "pacdn.",
  "macdn.",
  "pbcdnw.",
  "spa.",
  "h5-api.",
];

function isAllowedHost(host: string): boolean {
  if (!host) return false;
  if (ALLOWED_HOSTS.has(host)) return true;
  return ALLOWED_PREFIX_HOSTS.some((p) => host.startsWith(p));
}

function buildDefaultReferer(url: URL, detailPath?: string | null): string {
  // Default to the boxmovies movies page (same path the real player uses).
  const dp =
    detailPath ||
    decodeURIComponent(url.pathname.match(/\/resource\/([^/?]+)/)?.[1] || "")
      .replace(/\.mp4$/, "")
      .replace(/^[a-f0-9]{32}$/, "");
  return `https://boxmovies.org/movies/${dp || "play"}?id=&type=/movie/detail&lang=en`;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const target = searchParams.get("url");
  const customReferer = searchParams.get("referer");
  const detailPath = searchParams.get("detailPath");

  if (!target) {
    return NextResponse.json({ error: "Missing url" }, { status: 400 });
  }

  let targetUrl: URL;
  try {
    targetUrl = new URL(target);
  } catch {
    return NextResponse.json({ error: "Invalid url" }, { status: 400 });
  }

  if (!isAllowedHost(targetUrl.host)) {
    return NextResponse.json(
      { error: `Host not allowed: ${targetUrl.host}` },
      { status: 400 }
    );
  }

  // Build the upstream headers.
  const upstreamHeaders: Record<string, string> = {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36",
    "Accept": "*/*",
    "Accept-Language": "en-US,en;q=0.9",
    "Referer": customReferer || buildDefaultReferer(targetUrl, detailPath),
    "Origin": "https://boxmovies.org",
  };

  // Pass through the browser's Range header so seeking still works.
  const browserRange = req.headers.get("range");
  if (browserRange) upstreamHeaders["Range"] = browserRange;

  let upstream: Response;
  try {
    upstream = await fetch(targetUrl.toString(), {
      method: "GET",
      headers: upstreamHeaders,
      redirect: "follow",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Upstream fetch failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }

  // Build the response headers we send back to the browser.
  const responseHeaders = new Headers();
  const passthroughHeaders = [
    "content-type",
    "content-length",
    "content-range",
    "accept-ranges",
    "last-modified",
    "etag",
    "cache-control",
  ];
  for (const h of passthroughHeaders) {
    const v = upstream.headers.get(h);
    if (v) responseHeaders.set(h, v);
  }

  // Make sure the browser knows it can seek.
  if (!responseHeaders.has("accept-ranges")) {
    responseHeaders.set("accept-ranges", "bytes");
  }

  // Short cache. Signed URLs are short-lived; we want the browser to
  // re-fetch the proxy URL when the upstream signs expire.
  responseHeaders.set("cache-control", "public, max-age=60, s-maxage=60");

  // The video data is streamed straight through — never buffer the whole
  // 2GB movie in memory. Next.js's edge runtime doesn't support this,
  // which is why we set `runtime = "nodejs"`.
  return new Response(upstream.body, {
    status: upstream.status,
    headers: responseHeaders,
  });
}
