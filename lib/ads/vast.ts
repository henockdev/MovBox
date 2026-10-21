/**
 * Minimal VAST 3.0 reader for the in-stream pre-roll.
 *
 * Scope is deliberately narrow: we only need what a linear MP4/webm pre-roll
 * exposes. This is not a general VAST implementation and does not try to be —
 * VAST wrappers, multiple creatives, tracking beacons of every kind, and
 * companion ads are all out of scope. If a creative uses them, the parser
 * returns a reason string and the caller yields to the content. An ad we do
 * not understand must never become an ad we cannot skip.
 */

export interface VastMediaFile {
  url: string;
  type: string;
}

export interface VastCreative {
  mediaFiles: VastMediaFile[];
  impressions: string[];
  clickThrough: string | null;
  /** Duration in seconds, if the document declares one. */
  durationS: number | null;
  /** Seconds before the viewer may skip, from <Linear skipoffset>. */
  skipOffsetS: number | null;
}

export type VastParse =
  | { ok: true; creative: VastCreative }
  | { ok: false; reason: string };

/** "HH:MM:SS(.mmm)" → seconds. Null on anything unparseable. */
function parseVastTime(value: string | null | undefined): number | null {
  if (!value) return null;
  const parts = value.trim().split(":");
  if (parts.length !== 3) return null;
  const nums = parts.map(Number);
  if (!nums.every((n) => Number.isFinite(n))) return null;
  const [h, m, s] = nums;
  return h * 3600 + m * 60 + s;
}

function text(node: Element | null | undefined): string {
  return node?.textContent?.trim() ?? "";
}

/**
 * Parse the first <Linear> creative out of a VAST document.
 *
 * Always returns an explicit reason on failure. The ad server rotates
 * creatives, so one bad response usually means "this fill was malformed",
 * not "the zone is broken" — and without the distinction those look
 * identical in the console and stay undiagnosed.
 */
export function parseVast(xmlText: string): VastParse {
  if (typeof window === "undefined") return { ok: false, reason: "no-dom" };

  let doc: Document;
  try {
    doc = new DOMParser().parseFromString(xmlText, "application/xml");
  } catch (e) {
    return {
      ok: false,
      reason: `domparser-threw:${e instanceof Error ? e.message : String(e)}`,
    };
  }

  if (doc.querySelector("parsererror")) {
    const msg = (doc.querySelector("parsererror")?.textContent || "")
      .trim()
      .replace(/\s+/g, " ")
      .slice(0, 200);
    return { ok: false, reason: `parsererror:${msg || "(empty)"}` };
  }

  if (doc.documentElement?.nodeName !== "VAST") {
    return { ok: false, reason: "root-not-vast" };
  }

  const linear = doc.querySelector("Linear");
  if (!linear) {
    // No video creative in this response — usually a no-fill rotation.
    return {
      ok: false,
      reason: `no-linear(ads:${doc.querySelectorAll("Ad").length},inline:${doc.querySelectorAll("InLine").length},wrapper:${doc.querySelectorAll("Wrapper").length})`,
    };
  }

  const mediaFiles: VastMediaFile[] = [];
  linear.querySelectorAll("MediaFile").forEach((node) => {
    const url = text(node);
    if (url) {
      mediaFiles.push({
        url,
        type: node.getAttribute("type") ?? "video/mp4",
      });
    }
  });
  if (mediaFiles.length === 0) return { ok: false, reason: "no-mediafile" };

  const impressions: string[] = [];
  // Scope impressions to the <Ad> that actually owns this creative.
  //
  // This is not defensive theory: the live zone 7538417 response carries TWO
  // <Linear> creatives and TWO <Impression> trackers. We play the first
  // creative, so firing the whole document's trackers would report an
  // impression for an ad that was never shown. Discrepancies between
  // reported and served impressions are the fastest way to get a publisher
  // account reviewed or suspended, so the trackers are scoped to the Ad we
  // actually play — and if we cannot find that scope we fire none rather
  // than guessing.
  const adScope = linear.closest("InLine") ?? linear.closest("Wrapper");
  if (adScope) {
    adScope.querySelectorAll("Impression").forEach((node) => {
      const url = text(node);
      if (url) impressions.push(url);
    });
  }

  const clickThrough =
    text(linear.querySelector("VideoClicks > ClickThrough")) || null;

  return {
    ok: true,
    creative: {
      mediaFiles,
      impressions,
      clickThrough,
      durationS: parseVastTime(linear.getAttribute("duration")),
      skipOffsetS: parseVastTime(linear.getAttribute("skipoffset")),
    },
  };
}

/** First media file this browser can actually decode. MP4 preferred. */
export function pickPlayableMedia(
  files: VastMediaFile[],
): { url: string; type: string } | null {
  if (typeof document === "undefined") return null;
  const probe = document.createElement("video");
  const sorted = [...files].sort((a, b) => {
    const aMp4 = a.type.includes("mp4") ? 0 : 1;
    const bMp4 = b.type.includes("mp4") ? 0 : 1;
    return aMp4 - bMp4;
  });
  for (const f of sorted) {
    try {
      if (probe.canPlayType(f.type) !== "") return f;
    } catch {
      /* canPlayType threw for a malformed MIME — skip this one */
    }
  }
  return null;
}

/**
 * Fire a VAST tracker URL.
 *
 * Trackers are cross-origin beacons that return nothing useful, so the
 * result never matters. sendBeacon is preferred because it survives the page
 * going away mid-request, which is the normal case here: a viewer who skips
 * navigates the ad away almost immediately.
 */
export function fireTracker(url: string): void {
  if (typeof window === "undefined" || !url) return;

  if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
    try {
      // An empty Blob gives the request a body without setting a
      // content-type, so this stays a simple CORS request rather than
      // triggering a preflight nobody will answer.
      if (navigator.sendBeacon(url, new Blob([]))) return;
    } catch {
      /* fall through */
    }
  }

  try {
    void fetch(url, { credentials: "omit", keepalive: true, mode: "no-cors" }).catch(
      () => {},
    );
  } catch {
    /* fall through to pixel */
  }

  // Last resort. Failure here is swallowed on purpose: it must never
  // interrupt playback.
  const img = new Image(1);
  img.src = url;
}