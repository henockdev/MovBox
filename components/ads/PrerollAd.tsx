"use client";

import { useEffect, useRef, useState } from "react";
import { X, Volume2, VolumeX } from "lucide-react";
import { EXOCLICK, track } from "@/lib/ads/exoclick";

/**
 * In-stream video pre-roll via ExoClick VAST (zone 6049850).
 *
 * Flow:
 *   1. Parent (Player) mounts this overlay on the first user-initiated
 *      play of a session.
 *   2. We fetch the VAST XML from the ExoClick tag URL and parse it.
 *   3. We pick the first <MediaFile> our browser can actually decode
 *      (mp4 preferred, then webm).
 *   4. We fire the VAST <Impression> tracker and play the ad full-bleed
 *      over the player, firing each <Tracking event="progress"> beacon
 *      as the playhead crosses its offset.
 *   5. Clicking the ad opens the <ClickThrough> URL in a new tab.
 *   6. When the ad ends — or the user skips once the VAST skipoffset is
 *      reached — we call onComplete and the parent starts the content.
 *
 * Failure policy: an ad must never block the content. Any error path
 * (fetch failed, no playable media, media decode error) fires the VAST
 * <Error> tracker and then calls onComplete shortly after.
 *
 * Frequency cap: at most 1 pre-roll per 30-minute session, stored in
 * localStorage under "movbox:ad:preroll:done" (timestamp).
 */

const SESSION_TTL_MS = 30 * 60 * 1000;
/** Used only when the VAST response omits a skipoffset. */
const DEFAULT_SKIP_AFTER_S = 5;
/** VAST error codes we can actually report. */
const VAST_ERR_NO_MEDIA = 101;
const VAST_ERR_NO_FILE = 100;

interface PrerollAdProps {
  /** Called when the ad finishes or is skipped. */
  onComplete: () => void;
}

interface VastMediaFile {
  url: string;
  type: string;
}

interface VastTracker {
  url: string;
  /** Seconds into the ad at which this progress beacon fires. */
  offsetS: number;
}

interface VastCreative {
  mediaFiles: VastMediaFile[];
  impressions: string[];
  clickThrough: string | null;
  progress: VastTracker[];
  errorTrackers: string[];
  skipOffsetS: number | null;
}

function canPlayType(type: string): boolean {
  if (typeof document === "undefined") return false;
  const v = document.createElement("video");
  return v.canPlayType(type) !== "";
}

function pickPlayableMedia(files: VastMediaFile[]): string | null {
  // Prefer mp4 (universally supported), then webm.
  const sorted = [...files].sort((a, b) => {
    const aMp4 = a.type.includes("mp4") ? 0 : 1;
    const bMp4 = b.type.includes("mp4") ? 0 : 1;
    return aMp4 - bMp4;
  });
  for (const f of sorted) {
    if (canPlayType(f.type)) return f.url;
  }
  return null;
}

/** "HH:MM:SS(.mmm)" → seconds. Returns null on anything unparseable. */
function parseVastTime(value: string | null | undefined): number | null {
  if (!value) return null;
  const parts = value.trim().split(":");
  if (parts.length !== 3) return null;
  const nums = parts.map((p) => Number(p));
  if (!nums.every((n) => Number.isFinite(n))) return null;
  const [h, m, s] = nums;
  return h * 3600 + m * 60 + s;
}

/** Read a CDATA-or-text element's trimmed content. */
function text(node: Element | null | undefined): string {
  return node?.textContent?.trim() ?? "";
}

/**
 * Parse the first <Linear> creative out of a VAST document.
 *
 * Returns a `reason` alongside the creative on every failure path. The ad
 * server rotates creatives, so a single parse failure can mean "this one
 * response was malformed" rather than "the zone is broken" — and with the
 * old signature both looked identical in the console as
 * "Unparseable VAST", which is why this went undiagnosed for days.
 */
function parseVast(xmlText: string): {
  creative: VastCreative | null;
  reason: string;
} {
  if (typeof window === "undefined") {
    return { creative: null, reason: "no-dom" };
  }
  let doc: Document;
  try {
    doc = new DOMParser().parseFromString(xmlText, "application/xml");
  } catch (e) {
    return {
      creative: null,
      reason: `domparser-threw: ${e instanceof Error ? e.message : String(e)}`,
    };
  }

  const parserError = doc.querySelector("parsererror");
  if (parserError) {
    const msg = (parserError.textContent || "").trim().replace(/\s+/g, " ").slice(0, 200);
    return { creative: null, reason: `parsererror: ${msg || "(empty)"}` };
  }

  const root = doc.documentElement;
  if (!root || root.nodeName !== "VAST") {
    return {
      creative: null,
      reason: `root-is-${root ? root.nodeName : "null"}: ${xmlText.slice(0, 120)}`,
    };
  }

  const linear = doc.querySelector("Linear");
  if (!linear) {
    // No video creative in this response — usually a no-fill rotation.
    return {
      creative: null,
      reason: `no-linear (ads:${doc.querySelectorAll("Ad").length} inline:${doc.querySelectorAll("InLine").length} wrapper:${doc.querySelectorAll("Wrapper").length})`,
    };
  }

  const mediaFiles: VastMediaFile[] = [];
  linear.querySelectorAll("MediaFile").forEach((node) => {
    const url = text(node);
    if (url) {
      mediaFiles.push({ url, type: node.getAttribute("type") ?? "video/mp4" });
    }
  });

  const impressions: string[] = [];
  doc.querySelectorAll("Impression").forEach((node) => {
    const url = text(node);
    if (url) impressions.push(url);
  });

  const clickThrough = text(linear.querySelector("VideoClicks > ClickThrough")) || null;

  const progress: VastTracker[] = [];
  linear
    .querySelectorAll('TrackingEvents > Tracking[event="progress"]')
    .forEach((node) => {
      const url = text(node);
      const offsetS = parseVastTime(node.getAttribute("offset"));
      if (url && offsetS !== null) progress.push({ url, offsetS });
    });
  progress.sort((a, b) => a.offsetS - b.offsetS);

  const errorTrackers: string[] = [];
  doc.querySelectorAll("Error").forEach((node) => {
    const url = text(node);
    if (url) errorTrackers.push(url);
  });

  return {
    reason: "ok",
    creative: {
      mediaFiles,
      impressions,
      clickThrough,
      progress,
      errorTrackers,
      skipOffsetS: parseVastTime(linear.getAttribute("skipoffset")),
    },
  };
}

/** Substitute the [ERRORCODE] placeholder every network uses. */
function fireErrorTrackers(urls: string[], code: number): void {
  for (const raw of urls) track(raw.replace(/\[ERRORCODE\]/g, String(code)));
}

function wasShownRecently(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const raw = window.localStorage.getItem("movbox:ad:preroll:done");
    if (!raw) return false;
    const t = Number(raw);
    return Number.isFinite(t) && Date.now() - t < SESSION_TTL_MS;
  } catch {
    return false;
  }
}

function markShown(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem("movbox:ad:preroll:done", String(Date.now()));
  } catch {
    /* noop */
  }
}

/** Best-effort server-side impression log; never blocks playback. */
function reportImpression(): void {
  try {
    void fetch("/api/ads/impression", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ slot: "in-stream" }),
      keepalive: true,
    }).catch(() => {});
  } catch {
    /* noop */
  }
}

export function PrerollAd({ onComplete }: PrerollAdProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [status, setStatus] = useState<
    "loading" | "playing" | "skipped" | "ended" | "error"
  >("loading");
  const [elapsed, setElapsed] = useState(0);
  const [muted, setMuted] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [skipAfterS, setSkipAfterS] = useState(DEFAULT_SKIP_AFTER_S);

  // Parsed VAST data, kept in refs so the effects below don't need it as
  // a dependency (and so changing it never re-runs the fetch).
  const clickThroughRef = useRef<string | null>(null);
  const progressRef = useRef<VastTracker[]>([]);
  const firedProgressRef = useRef<Set<string>>(new Set());
  const errorTrackersRef = useRef<string[]>([]);

  // Fetch + parse the VAST tag, fire the impression, then start the ad.
  useEffect(() => {
    let cancelled = false;

    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

    /**
     * One fetch + parse attempt.
     *
     * Retried once: ExoClick rotates creatives per request and a single
     * response can come back without a <Linear> (no-fill rotation) or in a
     * shape this parser rejects. A fresh request almost always returns a
     * usable one, so a second attempt converts a lost impression into a
     * played one — and costs 400ms worst case.
     */
    const attempt = async (n: number): Promise<VastCreative> => {
      // credentials: "include" so ExoClick's own zone-cap cookie
      // round-trips and they can apply server-side capping. Their
      // response sets Access-Control-Allow-Credentials specifically
      // to allow this.
      const res = await fetch(EXOCLICK.inStreamVastUrl, {
        credentials: "include",
        cache: "no-store",
      });
      if (!res.ok) {
        throw Object.assign(new Error(`VAST fetch ${res.status}`), {
          httpStatus: res.status,
        });
      }
      const xml = await res.text();

      const { creative, reason } = parseVast(xml);
      if (!creative) {
        // Log enough to tell "zone is unfilled" from "we cannot parse a
        // perfectly good response" without guessing from the message alone.
        console.warn(
          `[preroll] attempt ${n} rejected — reason=${reason} bytes=${xml.length}`,
        );
        throw Object.assign(new Error(`Unparseable VAST (${reason})`), {
          vastReason: reason,
          bytes: xml.length,
        });
      }
      return creative;
    };

    (async () => {
      try {
        // If we've already shown a pre-roll in this session, skip
        // immediately and let the real content play.
        if (wasShownRecently()) {
          onComplete();
          return;
        }

        let creative: VastCreative;
        try {
          creative = await attempt(1);
        } catch (first) {
          if (cancelled) return;
          await sleep(400);
          if (cancelled) return;
          creative = await attempt(2);
        }
        if (cancelled) return;

        errorTrackersRef.current = creative.errorTrackers;

        const url = pickPlayableMedia(creative.mediaFiles);
        if (!url) {
          fireErrorTrackers(creative.errorTrackers, VAST_ERR_NO_FILE);
          throw new Error("No playable media in VAST");
        }

        clickThroughRef.current = creative.clickThrough;
        progressRef.current = creative.progress;
        firedProgressRef.current = new Set();
        setSkipAfterS(creative.skipOffsetS ?? DEFAULT_SKIP_AFTER_S);

        // Count the impression before the first frame so a user who
        // skips instantly still registers.
        for (const imp of creative.impressions) track(imp);
        reportImpression();

        setStatus("playing");
        requestAnimationFrame(() => {
          if (videoRef.current) {
            videoRef.current.src = url;
            videoRef.current.muted = true;
            videoRef.current
              .play()
              .catch((e) => console.warn("[preroll] autoplay failed", e));
          }
        });
        markShown();
      } catch (e) {
        if (cancelled) return;
        console.warn("[preroll] failed:", e);
        setErrorMsg(e instanceof Error ? e.message : "Ad failed");
        setStatus("error");
        // Don't block the user — let the real content play.
        setTimeout(() => onComplete(), 1500);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [onComplete]);

  // Tick the elapsed counter so the skip button unlocks at the VAST
  // skipoffset. The counter is wall-clock, not media-time, so a stalled
  // ad still becomes skippable.
  useEffect(() => {
    if (status !== "playing") return;
    setElapsed(0);
    const start = Date.now();
    const t = setInterval(() => {
      const e = (Date.now() - start) / 1000;
      setElapsed(e);
      if (e >= skipAfterS) clearInterval(t);
    }, 250);
    return () => clearInterval(t);
  }, [status, skipAfterS]);

  // Fire each progress beacon once as the playhead crosses its offset.
  useEffect(() => {
    if (status !== "playing") return;
    const video = videoRef.current;
    if (!video) return;
    const onTimeUpdate = () => {
      const fired = firedProgressRef.current;
      for (const tracker of progressRef.current) {
        if (fired.has(tracker.url)) continue;
        // 0.25s of slack: the browser fires timeupdate on a coarse
        // schedule and can land just short of the exact offset.
        if (video.currentTime + 0.25 >= tracker.offsetS) {
          fired.add(tracker.url);
          track(tracker.url);
        }
      }
    };
    video.addEventListener("timeupdate", onTimeUpdate);
    return () => video.removeEventListener("timeupdate", onTimeUpdate);
  }, [status]);

  function handleSkip() {
    if (elapsed < skipAfterS) return;
    setStatus("skipped");
    onComplete();
  }

  function handleEnded() {
    setStatus("ended");
    onComplete();
  }

  function handleMediaError() {
    fireErrorTrackers(errorTrackersRef.current, VAST_ERR_NO_MEDIA);
    setStatus("error");
    setErrorMsg("Video failed");
    setTimeout(() => onComplete(), 1500);
  }

  function handleClick() {
    const url = clickThroughRef.current;
    if (!url) return;
    // The ClickThrough URL is itself the click tracker (it 302s to the
    // advertiser), so simply opening it records the click.
    window.open(url, "_blank", "noopener,noreferrer");
  }

  function toggleMute() {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
    setMuted(v.muted);
  }

  const canSkip = elapsed >= skipAfterS;

  return (
    <div
      className="absolute inset-0 z-50 flex items-center justify-center bg-black"
      role="region"
      aria-label="Advertisement"
    >
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={muted}
        onEnded={handleEnded}
        onError={handleMediaError}
        onClick={handleClick}
        className="h-full w-full cursor-pointer bg-black object-contain"
      />

      {/* Top bar: ad label + skip button */}
      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between p-3 sm:p-4">
        <div className="pointer-events-auto inline-flex items-center gap-2 rounded-md bg-black/70 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-white backdrop-blur">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent-bright" />
          Ad · Sponsored
        </div>
        <div className="pointer-events-auto flex items-center gap-2">
          <button
            type="button"
            onClick={toggleMute}
            aria-label={muted ? "Unmute" : "Mute"}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-black/70 text-white backdrop-blur transition-colors hover:bg-black/90"
          >
            {muted ? (
              <VolumeX className="h-4 w-4" />
            ) : (
              <Volume2 className="h-4 w-4" />
            )}
          </button>
          <button
            type="button"
            onClick={handleSkip}
            disabled={!canSkip}
            aria-label={
              canSkip
                ? "Skip advertisement"
                : `Skip in ${Math.ceil(skipAfterS - elapsed)}s`
            }
            className="inline-flex h-9 items-center gap-1.5 rounded-full bg-black/70 px-3 text-xs font-semibold text-white backdrop-blur transition-colors hover:bg-black/90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {canSkip ? "Skip Ad" : `Skip in ${Math.ceil(skipAfterS - elapsed)}s`}
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Bottom: small loading hint if the ad is still buffering */}
      {(status === "loading" || status === "error") && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-center p-3 sm:p-4">
          <div className="inline-flex items-center gap-2 rounded-md bg-black/70 px-3 py-1.5 text-[10px] font-medium text-white/80 backdrop-blur">
            {status === "error"
              ? `Ad unavailable — playing next in a sec${errorMsg ? ` (${errorMsg})` : ""}`
              : "Loading ad…"}
          </div>
        </div>
      )}
    </div>
  );
}