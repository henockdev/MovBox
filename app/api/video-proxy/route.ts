import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/video-proxy?url=<encoded upstream media url>
 *
 * The site's own byte path for video.
 *
 * ---------------------------------------------------------------------------
 * Why the bytes come through here
 * ---------------------------------------------------------------------------
 * Two different CDNs with two OPPOSITE Referer rules sit behind this route:
 *
 *   | host                          | Referer the CDN accepts        |
 *   |-------------------------------|--------------------------------|
 *   | bcdn.hakunaymatata.com        | NONE — any Referer gets a 429 |
 *   | bcdnxw.hakunaymatata.com      | https://boxmovies.org/…        |
 *   | pacdn/macdn/pbcdnw.aoneroom   | https://boxmovies.org/…        |
 *
 * A browser always sends a Referer for a cross-origin media request and is
 * forbidden from setting one itself, so neither CDN can be talked to
 * directly from the player. We fetch the bytes here instead, with exactly
 * the headers each host demands, and stream them straight through.
 *
 * The OnStream host (bcdn) is the primary ladder — it is the one the
 * OnStream backend signs. It is the INVERSE of the boxmovies hosts: it
 * returns 429 for ANY Referer, including an empty one, and only serves the
 * request when the Referer header is absent entirely. So for those hosts we
 * send no Referer and no Origin.
 *
 * Range requests are passed through end-to-end so seeking still works, and
 * the response is streamed rather than buffered (a 300 MB movie must never
 * be held in memory).
 *
 * Query params:
 *   url        (required) — fully qualified upstream media URL
 *   referer    (optional) — override the referer (boxmovies hosts only)
 *   detailPath (optional) — used to build a sensible default referer
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const ALLOWED_HOSTS = new Set([
  "bcdn.hakunaymatata.com",
  "bcdnxw.hakunaymatata.com",
  "pacdn.aoneroom.com",
  "macdn.aoneroom.com",
  "pbcdnw.aoneroom.com",
  "spa.hakunaymatata.com",
  "spa.aoneroom.com",
  "h5-api.aoneroom.com",
]);

const ALLOWED_PREFIX_HOSTS = [
  "bcdn.",
  "bcdnxw.",
  "pacdn.",
  "macdn.",
  "pbcdnw.",
  "spa.",
  "h5-api.",
];

/**
 * Hosts that refuse every request that carries a Referer.
 *
 * Measured 2026-10-24 against the live CDN:
 *   bcdn, no Referer          -> HTTP 206 video/mp4
 *   bcdn, Referer movbox.xyz  -> HTTP 429
 *   bcdn, Referer boxmovies   -> HTTP 429
 *   bcdn, Referer "" (empty)  -> HTTP 429
 */
const NO_REFERER_HOSTS = ["bcdn."];

/**
 * Hosts that refuse a browser User-Agent.
 *
 * The OnStream CDN answers HTTP 428 Forbidden to anything that looks like a
 * browser and serves the file to a plain client instead. Measured 2026-10-24
 * against the live host:
 *   bcdn, User-Agent okhttp/4.12.0 -> HTTP 206 video/mp4
 *   bcdn, no User-Agent            -> HTTP 206 video/mp4
 *   bcdn, User-Agent Chrome/127    -> HTTP 428 Forbidden
 *
 * The legacy boxmovies hosts are left on the browser User-Agent they have
 * always been served with.
 */
const NO_BROWSER_UA_HOSTS = ["bcdn."];

const BROWSER_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36";
const PLAIN_USER_AGENT = "okhttp/4.12.0";

function isAllowedHost(host: string): boolean {
  if (!host) return false;
  if (ALLOWED_HOSTS.has(host)) return true;
  return ALLOWED_PREFIX_HOSTS.some((p) => host.startsWith(p));
}

/** Does this host 429 on any Referer? */
function forbidsReferer(host: string): boolean {
  return NO_REFERER_HOSTS.some((p) => host.startsWith(p));
}

/** Does this host 428 on a browser User-Agent? */
function forbidsBrowserUserAgent(host: string): boolean {
  return NO_BROWSER_UA_HOSTS.some((p) => host.startsWith(p));
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

  if (targetUrl.protocol !== "https:" && targetUrl.protocol !== "http:") {
    return NextResponse.json(
      { error: `Unsupported protocol: ${targetUrl.protocol}` },
      { status: 400 },
    );
  }

  if (!isAllowedHost(targetUrl.host)) {
    return NextResponse.json(
      { error: `Host not allowed: ${targetUrl.host}` },
      { status: 400 },
    );
  }

  // Build the upstream headers.
  const upstreamHeaders: Record<string, string> = {
    "User-Agent": forbidsBrowserUserAgent(targetUrl.host)
      ? PLAIN_USER_AGENT
      : BROWSER_USER_AGENT,
    Accept: "*/*",
    "Accept-Language": "en-US,en;q=0.9",
  };

  if (forbidsReferer(targetUrl.host)) {
    // No Referer, no Origin. Not an oversight — this host 429s on both.
    delete upstreamHeaders.Referer;
    delete upstreamHeaders.Origin;
  } else {
    upstreamHeaders.Referer =
      customReferer || buildDefaultReferer(targetUrl, detailPath);
    upstreamHeaders.Origin = "https://boxmovies.org";
  }

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
  // movie in memory. Vercel's 4.5 MB response cap does not apply to
  // streamed responses.
  return new Response(upstream.body, {
    status: upstream.status,
    headers: responseHeaders,
  });
}
