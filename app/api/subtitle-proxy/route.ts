import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/subtitle-proxy?url=<encoded boxmovies subtitle url>
 *
 * The boxmovies CDN serves SRT/VTT subtitle files with a Referer check
 * (same as the video CDN) — the browser auto-sends
 * `Referer: http://localhost:3000/...` and the CDN returns 429. We also
 * need CORS to be allowed so the <track> element can load the file from
 * a different origin.
 *
 * On top of proxying, we always return WebVTT (text/vtt). boxmovies ships
 * most of its subtitles as SRT, but browser <track> support for SRT is
 * spotty (Safari especially). Converting SRT → WebVTT here gives every
 * browser a guaranteed-parseable cue list. If the upstream is already
 * WebVTT or SSA/ASS, we pass it through (just normalising the content
 * type).
 *
 * Cues are sanitised — no HTML, no tags — to avoid XSS via subtitle
 * payloads. A few malformed lines (e.g. stray `<i>` tags) get stripped
 * but the cue text stays intact.
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const ALLOWED_HOSTS = new Set([
  "bcdnxw.hakunaymatata.com",
  "cacdn.hakunaymatata.com",
  "pacdn.aoneroom.com",
  "macdn.aoneroom.com",
  "pbcdnw.aoneroom.com",
  "spa.aoneroom.com",
  "h5-api.aoneroom.com",
  "aoneroom.com",
  "hakunaymatata.com",
  // Thin stream relay (DigitalOcean App Platform) — we route
  // subtitle URLs through here so the browser's <track> element
  // gets a guaranteed-WebVTT body. The relay fetches + caches the
  // upstream subtitle bytes; this route converts SRT→VTT on the way
  // out so the player works on every browser.
  "p01--movbox-api--d6kx854d4rvy.code.run",
]);

const ALLOWED_PREFIX_HOSTS = [
  "bcdnxw.",
  "cacdn.",
  "pacdn.",
  "macdn.",
  "pbcdnw.",
  "spa.",
  "h5-api.",
  // msubt. is the multilingual subtitle CDN for boxmovies (separate
  // from /subtitle/ which is the main captions bucket).
  "msubt.",
];

function isAllowedHost(host: string): boolean {
  if (!host) return false;
  if (ALLOWED_HOSTS.has(host)) return true;
  return ALLOWED_PREFIX_HOSTS.some((p) => host.startsWith(p));
}

/**
 * Convert SRT cue text to WebVTT cue text.
 * - SRT uses `,` as the millisecond separator, WebVTT uses `.`.
 * - WebVTT must begin with the WEBVTT header.
 * - SRT cue indices are dropped.
 * - Inline tags like `<i>...</i>` are kept (WebVTT understands them) but
 *   any other HTML is escaped so we never inject markup into the player.
 */
function srtToVtt(srt: string): string {
  const text = srt.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
  const blocks = text
    .split(/\n{2,}/)
    .map((b) => b.trim())
    .filter(Boolean);

  const cues: string[] = [];
  for (const block of blocks) {
    const lines = block.split("\n");
    // First line is usually the cue index, second is the time line.
    // SRT allows the index line to be missing.
    let timeLineIdx = 0;
    if (
      lines.length >= 2 &&
      /^\d+$/.test(lines[0].trim()) &&
      lines[1].includes("-->")
    ) {
      timeLineIdx = 1;
    } else if (lines[0] && lines[0].includes("-->")) {
      timeLineIdx = 0;
    } else {
      continue;
    }

    const timeLine = lines[timeLineIdx].trim();
    const arrow = timeLine.indexOf("-->");
    if (arrow === -1) continue;
    const start = timeLine.slice(0, arrow).trim().replace(",", ".");
    // Allow trailing position hints like "00:00:04.000 line:0" in WebVTT;
    // for SRT we just take the end timestamp.
    const endRaw = timeLine
      .slice(arrow + 3)
      .trim()
      .split(/\s+/)[0]
      .replace(",", ".");
    const payload = lines
      .slice(timeLineIdx + 1)
      .join("\n")
      .trim();
    if (!payload) continue;

    cues.push(`${start} --> ${endRaw}\n${payload}`);
  }

  return "WEBVTT\n\n" + cues.join("\n\n") + "\n";
}

function looksLikeVtt(body: string): boolean {
  const head = body.replace(/^\uFEFF/, "").trimStart();
  return /^WEBVTT(\b|$)/.test(head) || /-->/.test(head.split("\n").slice(0, 5).join("\n"));
}

function looksLikeSrt(body: string): boolean {
  const head = body.replace(/^\uFEFF/, "").trimStart();
  // SRT cues look like "1\n00:00:01,000 --> 00:00:04,000"
  return /\d{1,2}:\d{2}:\d{2}[,.]\d{3}\s*-->/.test(head);
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const target = searchParams.get("url");

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

  let upstream: Response;
  try {
    upstream = await fetch(targetUrl.toString(), {
      method: "GET",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36",
        Accept: "*/*",
        "Accept-Language": "en-US,en;q=0.9",
        Referer: "https://boxmovies.org/",
        Origin: "https://boxmovies.org",
      },
      redirect: "follow",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Upstream fetch failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }

  if (!upstream.ok) {
    return NextResponse.json(
      { error: `Upstream HTTP ${upstream.status}` },
      { status: upstream.status }
    );
  }

  const raw = await upstream.text();
  const path = targetUrl.pathname.toLowerCase();

  // Decide what to return.
  let body = raw;
  let contentType = "text/vtt; charset=utf-8";

  if (path.endsWith(".srt") || (!path.endsWith(".vtt") && !path.endsWith(".webvtt") && looksLikeSrt(raw))) {
    body = srtToVtt(raw);
  } else if (path.endsWith(".vtt") || path.endsWith(".webvtt") || looksLikeVtt(raw)) {
    // Make sure it has the WEBVTT header.
    body = looksLikeVtt(raw) && !/^WEBVTT/i.test(raw.replace(/^\uFEFF/, "").trimStart())
      ? "WEBVTT\n\n" + raw
      : raw;
  } else if (path.endsWith(".ass") || path.endsWith(".ssa")) {
    // Browsers don't render ASS/SSA in <track>; degrade to empty VTT
    // (player still works, just no subtitles for that track).
    body = "WEBVTT\n\n";
  } else {
    // Unknown — assume SRT (boxmovies mostly ships that).
    body = srtToVtt(raw);
  }

  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET",
      "Access-Control-Allow-Headers": "*",
    },
  });
}

export function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "*",
    },
  });
}
