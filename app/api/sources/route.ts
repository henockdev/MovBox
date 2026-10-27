import { NextRequest, NextResponse } from "next/server";
import { getBoxmoviesDetail, getBoxmoviesStream } from "@/lib/data";
import { onStreamConfigured } from "@/lib/onstream/gateway";
import { resolveEpisode } from "@/lib/onstream/client";
import type { BoxCaption, BoxSource, BoxSourceGroup } from "@/lib/types";

/**
 * GET /api/sources?detailPath=...&season=N&episode=N
 *
 * ---------------------------------------------------------------------------
 * Where the sources come from
 * ---------------------------------------------------------------------------
 * Two backends, one response shape:
 *
 *   1. OnStream (aoneroom mobile BFF) — PRIMARY.
 *      Resolved by this Next.js process: session bootstrap → resolution sweep
 *      → sniff/config → a real signed media URL on bcdn.hakunaymatata.com,
 *      plus the episode's subtitle tracks. The URL we hand back is a RAW
 *      upstream URL, which the player wraps in /api/video-proxy — so the
 *      media bytes are streamed by our own proxy and the separately hosted
 *      relay is not involved at all.
 *
 *   2. The thin relay — FALLBACK.
 *      Used when OnStream is not configured (no gateway key) or when the
 *      subject has no OnStream resource. Unchanged behaviour: the relay's
 *      own /mp4 and /subtitle URLs are handed to the player as-is.
 *
 * The relay is the safety net, not the primary path. Every OnStream failure
 * is logged and falls through to it.
 *
 * ---------------------------------------------------------------------------
 * The shape returned here is unchanged from the old boxmovies-api shape so
 * the player code does not need to know which backend answered.
 *
 * The one addition is the `onstream` diagnostic object: it states whether the
 * gateway key was present in this runtime, whether OnStream answered, and if
 * not, why the relay was used. Without it a misconfigured deployment looks
 * exactly like a healthy one.
 * ---------------------------------------------------------------------------
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const TIMEOUT_MS = 25_000;

async function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  let t: ReturnType<typeof setTimeout> | null = null;
  try {
    return await Promise.race([
      p,
      new Promise<T>((_, rej) => {
        t = setTimeout(() => rej(new Error(`${label} timed out after ${ms}ms`)), ms);
      }),
    ]);
  } finally {
    if (t) clearTimeout(t);
  }
}

/**
 * Subtitle URLs need different treatment per backend.
 *
 * A relay /subtitle URL is already WebVTT served by the relay — pass it
 * through untouched. A RAW upstream caption URL (the OnStream path) has to go
 * through our own proxy: the CDN demands a Referer the browser cannot set,
 * and a browser <track> only understands text/vtt, which our proxy
 * guarantees by converting SRT on the way out.
 */
function toPlayerSubtitleUrl(upstreamOrRelayUrl: string): string {
  if (!upstreamOrRelayUrl) return upstreamOrRelayUrl;
  if (upstreamOrRelayUrl.startsWith("/api/subtitle-proxy")) {
    return upstreamOrRelayUrl;
  }
  try {
    const u = new URL(upstreamOrRelayUrl, "http://relay.invalid");
    if (u.pathname.endsWith("/subtitle")) return upstreamOrRelayUrl;
  } catch {
    /* unparseable -> fall through to the legacy proxy */
  }
  return `/api/subtitle-proxy?url=${encodeURIComponent(upstreamOrRelayUrl)}`;
}

type Provider = { id: "boxmovies" | "onstream"; name: string };

const ONSTREAM_PROVIDER: Provider = { id: "onstream", name: "OnStream" };
const RELAY_PROVIDER: Provider = { id: "boxmovies", name: "BoxMovies" };

/**
 * Why the primary path did or did not answer.
 *
 * The relay fallback is deliberately silent — that is what makes it a safe
 * safety net. But a silent fallback is also how a misconfigured deployment
 * looks perfectly healthy while running on the old path forever, so every
 * response states which backend answered and, when the fallback was taken,
 * why.
 *
 * `reason` is one of:
 *   "served"          — OnStream answered.
 *   "not-configured"  — no gateway key in this runtime.
 *   "no-subject-id"   — the catalogue entry could not be resolved.
 *   "no-resource"     — the upstream has no stream for this episode.
 *   "error: ..."      — the OnStream attempt threw.
 */
interface OnStreamDiagnostic {
  /** Is the gateway key material present in this runtime? */
  configured: boolean;
  /** Did OnStream answer this request? */
  active: boolean;
  /** Why it did not, when it did not. */
  reason: string;
}

/**
 * Strip anything credential-shaped out of an error message before it is
 * published, and keep it short. Upstream failures can quote the request URL,
 * which carries a signed token.
 */
function sanitizeReason(message: string): string {
  return message
    .replace(/\b(sign|token|secret|key|authorization)\s*[=:]\s*[^\s&"']*/gi, "$1=[redacted]")
    .slice(0, 200);
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const detailPath = searchParams.get("detailPath");
  const season = Number(searchParams.get("season") ?? 0);
  const episode = Number(searchParams.get("episode") ?? 0);
  const subjectId = searchParams.get("subjectId") ?? "";

  if (!detailPath) {
    return NextResponse.json({ error: "Missing detailPath" }, { status: 400 });
  }

  // -------------------------------------------------------------------------
  // Primary path: OnStream
  // -------------------------------------------------------------------------
  const onstream: OnStreamDiagnostic = {
    configured: onStreamConfigured(),
    active: false,
    reason: onStreamConfigured() ? "" : "not-configured",
  };

  if (onstream.configured) {
    try {
      let sid = subjectId;
      if (!sid) {
        const detail = await getBoxmoviesDetail(detailPath);
        if (detail) {
          const alt = (detail as { id?: string | number }).id;
          sid = String(detail.subjectId || alt || "");
        }
      }

      if (sid) {
        const resolved = await withTimeout(
          resolveEpisode(sid, season, episode),
          TIMEOUT_MS,
          `onstream ${detailPath}`,
        );

        if (resolved && resolved.rungs.length) {
          const captions: BoxCaption[] = resolved.captions.map((c) => ({
            id: c.id,
            url: c.url,
            languageCode: c.languageCode,
            language: c.language,
            delay: c.delay,
            sizeBytes: c.sizeBytes,
          }));

          const sources: BoxSource[] = resolved.rungs.map((r) => ({
            id: `${r.resolution}-${r.url.slice(-12)}`,
            // RAW upstream URL on purpose. The player's buildPlayableUrl()
            // wraps anything that is not already a relay /mp4 URL in
            // /api/video-proxy, so the bytes are streamed by our own
            // proxy — with no Referer, which is what this CDN demands.
            url: r.url,
            type: "mp4" as const,
            quality: r.quality,
            resolution: r.resolution,
            sizeBytes: r.sizeBytes,
            durationSeconds: r.durationSeconds,
            format: r.format,
            codec: r.codec,
            vipLocked: false,
            subtitles: captions.map((c) => ({
              id: c.id,
              url: toPlayerSubtitleUrl(c.url),
              languageCode: c.languageCode,
              language: c.language,
              delay: c.delay,
              sizeBytes: c.sizeBytes,
            })),
            provider: ONSTREAM_PROVIDER,
          }));

          const payload: BoxSourceGroup & {
            ok: boolean;
            provider: Provider;
            onstream: OnStreamDiagnostic;
            subtitleTracks: {
              id: string;
              url: string;
              language: string;
              label: string;
            }[];
          } = {
            ok: true,
            detailPath,
            season,
            episode,
            subjectId: sid,
            hasResource: true,
            isLimited: false,
            vipLocked: false,
            freeStreamsRemaining: undefined,
            sources,
            captions,
            subtitleTracks: captions.map((c) => ({
              id: c.id,
              url: toPlayerSubtitleUrl(c.url),
              language: c.languageCode,
              label: c.language,
            })),
            count: sources.length,
            provider: ONSTREAM_PROVIDER,
            onstream: { configured: true, active: true, reason: "served" },
          };

          return NextResponse.json(payload, {
            headers: {
              // The media URLs are signed and short-lived, so the resolved
              // ladder must not be cached for long.
              "Cache-Control": "public, max-age=60, s-maxage=120",
            },
          });
        }
        onstream.reason = "no-resource";
        console.warn(
          `[api/sources] onstream had no resource for ${detailPath} s${season}e${episode}; using the relay`,
        );
      } else {
        onstream.reason = "no-subject-id";
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      onstream.reason = `error: ${sanitizeReason(message)}`;
      console.warn(`[api/sources] onstream ${detailPath} failed: ${message}`);
    }
  }

  // -------------------------------------------------------------------------
  // Fallback path: the thin relay
  // -------------------------------------------------------------------------
  try {
    const data = await withTimeout(
      getBoxmoviesStream(detailPath, season, episode, subjectId),
      TIMEOUT_MS,
      `stream ${detailPath}`,
    );

    const sources: BoxSource[] = data.sources.map((s) => ({
      id: s.id,
      url: s.url,
      type: "mp4" as const,
      quality: s.quality,
      resolution: s.resolution,
      sizeBytes: s.sizeBytes,
      durationSeconds: s.durationSeconds,
      format: s.format,
      codec: s.codec,
      vipLocked: s.vipLocked,
      subtitles: data.captions.map((c) => ({
        id: c.id,
        url: toPlayerSubtitleUrl(c.url),
        languageCode: c.languageCode,
        language: c.language,
        delay: c.delay,
        sizeBytes: c.sizeBytes,
      })),
      provider: RELAY_PROVIDER,
    }));

    const subtitleTracks = data.captions.map((c) => ({
      id: c.id,
      url: toPlayerSubtitleUrl(c.url),
      language: c.languageCode,
      label: c.language,
    }));

    const payload: BoxSourceGroup & {
      ok: boolean;
      provider: Provider;
      onstream: OnStreamDiagnostic;
      subtitleTracks: { id: string; url: string; language: string; label: string }[];
    } = {
      ok: true,
      detailPath,
      season,
      episode,
      subjectId: data.subjectId,
      hasResource: !!data.hasResource,
      isLimited: !!data.isLimited,
      vipLocked: !!data.vipLocked,
      freeStreamsRemaining: data.freeStreamsRemaining,
      sources,
      captions: data.captions,
      subtitleTracks,
      count: sources.length,
      provider: RELAY_PROVIDER,
      onstream,
    };

    return NextResponse.json(payload, {
      headers: {
        // While the relay is answering, the diagnostic is the interesting
        // part of this response, so it must not be served from a cache.
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.warn(`[api/sources] ${detailPath} failed: ${message}`);
    return NextResponse.json(
      {
        ok: false,
        error: message,
        detailPath,
        season,
        episode,
        sources: [],
        captions: [],
        subtitleTracks: [],
        count: 0,
        provider: RELAY_PROVIDER,
        onstream,
      },
      { status: 504 },
    );
  }
}
