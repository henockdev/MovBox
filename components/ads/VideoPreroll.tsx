"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import { X, Volume2, VolumeX } from "lucide-react";
import {
  fireTracker,
  parseVast,
  pickPlayableMedia,
} from "@/lib/ads/vast";
import {
  HILLTOP,
  PREROLL_DEFAULT_SKIP_S,
  PREROLL_FETCH_TIMEOUT_MS,
  PREROLL_MAX_S,
  PREROLL_SESSION_KEY,
  PREROLL_TRIGGER_EVENT,
  adsEnabled,
} from "@/lib/ads/config";

/**
 * VideoPreroll — HilltopAds VAST pre-roll (zone 7538417).
 *
 * Overlays the player on the first user-initiated play of a session, then
 * dismisses and the content starts.
 *
 * THE ONE RULE THIS COMPONENT EXISTS TO UPHOLD
 * The ad must never hold the content hostage. Every single failure path —
 * fetch timeout, non-2xx, unparseable VAST, no playable media, decode error,
 * or a creative longer than our ceiling — calls `finish()` and hands the
 * viewer straight back to the movie. There is no state in which the viewer
 * cannot get to the content. `finish()` is idempotent, so the many paths that
 * can fail race each other harmlessly.
 *
 * WHY IT WAITS FOR AN EVENT INSTEAD OF RUNNING ON MOUNT
 * A pre-roll that begins fetching before the viewer has asked to watch
 * anything is wasted bandwidth and a wasted impression. It waits for
 * PREROLL_TRIGGER_EVENT, which the player fires only from a real user play
 * action. That is also what lets Player.tsx mount this without owning any
 * ad state — Player has a pinned hook count and cannot grow one.
 *
 * WHY IT PAUSES THE CONTENT VIDEO
 * Letting the movie run silently underneath and unmuting mid-scene later is
 * worse than a clean pause. We pause at the exact moment play intent is
 * signalled — before the movie has advanced a frame — and resume on finish.
 * Player's existing onPlay/onPause handlers keep the chrome in sync with no
 * cooperation from Player at all.
 */

type Status = "waiting" | "loading" | "playing" | "done";

export interface VideoPrerollProps {
  /** The movie's own <video> element, so we can pause and resume it. */
  contentRef: RefObject<HTMLVideoElement | null>;
}

export function VideoPreroll({ contentRef }: VideoPrerollProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  const [status, setStatus] = useState<Status>("waiting");
  const [elapsed, setElapsed] = useState(0);
  const [muted, setMuted] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);
  const [skipAfterS, setSkipAfterS] = useState(PREROLL_DEFAULT_SKIP_S);

  const clickThroughRef = useRef<string | null>(null);
  /** One VAST fetch per mount, no matter how many play intents arrive. */
  const startedRef = useRef(false);
  /** Guards the hand-back so it can only ever happen once. */
  const completedRef = useRef(false);
  /**
   * Set when this viewer must not see a pre-roll at all — ads globally off,
   * or the session cap already spent.
   *
   * A ref rather than state on purpose: an ineligible pre-roll and a waiting
   * one render exactly the same thing (null), so there is nothing to
   * re-render for, and calling setState in an effect body is a cascading
   * render for no gain. The effect below runs before the subscription effect
   * because it is declared first, so this is populated in time.
   */
  const disabledRef = useRef(false);

  /** Idempotent hand-back to the content. */
  const finish = useCallback(() => {
    if (completedRef.current) return;
    completedRef.current = true;

    const content = contentRef.current;
    if (content && content.paused) {
      const p = content.play();
      if (p && typeof p.catch === "function") {
        p.catch((e) =>
          console.warn("[preroll] content resume rejected:", e?.message ?? e),
        );
      }
    }

    setStatus("done");
  }, [contentRef]);

  // Resolve eligibility once on mount, before any network work.
  useEffect(() => {
    if (!adsEnabled()) {
      disabledRef.current = true;
      return;
    }
    try {
      if (window.localStorage.getItem(PREROLL_SESSION_KEY)) {
        // Already ran this session. Stay out of the way entirely.
        disabledRef.current = true;
      }
    } catch {
      /* storage blocked — proceed rather than never show it */
    }
  }, []);

  // Subscribe to play intent, then fetch and play the creative.
  useEffect(() => {
    if (status === "done" || disabledRef.current) return;

    let cancelled = false;
    let timer = 0;
    const controller = new AbortController();

    async function begin() {
      if (startedRef.current || disabledRef.current) return;
      startedRef.current = true;
      window.removeEventListener(PREROLL_TRIGGER_EVENT, begin);

      // Pause before we await anything, so the movie does not run ahead
      // of the viewer while the VAST tag is in flight.
      const content = contentRef.current;
      if (content && !content.paused) content.pause();

      setStatus("loading");
      timer = window.setTimeout(
        () => controller.abort(),
        PREROLL_FETCH_TIMEOUT_MS,
      );

      try {
        const res = await fetch(HILLTOP.vast.tagUrl, {
          // The network's capping cookie has to round-trip for its server-side
          // frequency cap to apply at all.
          credentials: "include",
          cache: "no-store",
          signal: controller.signal,
        });
        if (!res.ok) throw new Error(`VAST HTTP ${res.status}`);

        const xml = await res.text();
        if (cancelled) return;

        const parsed = parseVast(xml);
        if (!parsed.ok) {
          console.warn(
            `[preroll] VAST rejected — reason=${parsed.reason} bytes=${xml.length}`,
          );
          throw new Error(`Unparseable VAST (${parsed.reason})`);
        }

        const media = pickPlayableMedia(parsed.creative.mediaFiles);
        if (!media) throw new Error("No playable media in VAST");

        clickThroughRef.current = parsed.creative.clickThrough;
        setSkipAfterS(
          Math.min(
            parsed.creative.skipOffsetS ?? PREROLL_DEFAULT_SKIP_S,
            PREROLL_MAX_S,
          ),
        );

        // Count the impression before the first frame so a viewer who skips
        // immediately still registers.
        parsed.creative.impressions.forEach(fireTracker);
        reportImpression();

        try {
          window.localStorage.setItem(PREROLL_SESSION_KEY, String(Date.now()));
        } catch {
          /* noop */
        }

        if (cancelled) return;
        // Reset the skip counter here, in the event handler that started the
        // creative — not inside the effect that reads it. Setting it in the
        // effect body would be a cascading render.
        setElapsed(0);
        setStatus("playing");

        requestAnimationFrame(() => {
          const v = videoRef.current;
          if (!v) return;
          v.src = media.url;
          v.muted = true;
          const p = v.play();
          if (p && typeof p.catch === "function") {
            p.catch((e) =>
              console.warn("[preroll] autoplay rejected", e?.message ?? e),
            );
          }
        });
      } catch (e) {
        if (cancelled) return;
        // Any failure at all. The viewer gets their movie, immediately.
        console.warn(
          "[preroll] failed, yielding to content:",
          e instanceof Error ? e.message : e,
        );
        finish();
      }
    }

    window.addEventListener(PREROLL_TRIGGER_EVENT, begin);

    return () => {
      window.removeEventListener(PREROLL_TRIGGER_EVENT, begin);
      cancelled = true;
      controller.abort();
      if (timer) window.clearTimeout(timer);
    };
  }, [status, contentRef, finish]);

  // Wall-clock skip counter. Deliberately NOT media-time: if the creative
  // stalls or buffers, the viewer must still become able to skip.
  useEffect(() => {
    if (status !== "playing") return;
    const start = Date.now();
    const t = window.setInterval(() => {
      const e = (Date.now() - start) / 1000;
      setElapsed(e);
      if (e >= skipAfterS) window.clearInterval(t);
    }, 200);
    return () => window.clearInterval(t);
  }, [status, skipAfterS]);

  // Absolute ceiling. If the creative is longer than PREROLL_MAX_S we hand
  // back regardless — a third party's creative length is not something the
  // viewer has to sit through.
  useEffect(() => {
    if (status !== "playing") return;
    const t = window.setTimeout(finish, PREROLL_MAX_S * 1000);
    return () => window.clearTimeout(t);
  }, [status, finish]);

  if (status === "waiting" || status === "done") return null;

  const canSkip = elapsed >= skipAfterS;

  function handleSkip() {
    if (!canSkip) return;
    finish();
  }

  function handleEnded() {
    finish();
  }

  function handleMediaError() {
    setNotice("Ad unavailable — playing now");
    finish();
  }

  function handleClick() {
    const url = clickThroughRef.current;
    if (!url) return;
    // The ClickThrough URL is itself the click tracker (it redirects to the
    // advertiser), so opening it records the click. Standard VAST behaviour
    // for a linear creative: the whole video frame is the click target.
    window.open(url, "_blank", "noopener,noreferrer");
  }

  function toggleMute() {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
    setMuted(v.muted);
  }

  return (
    <div
      className="absolute inset-0 z-50 flex items-center justify-center bg-black"
      role="region"
      aria-label="Advertisement"
    >
      {status === "playing" && (
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
      )}

      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between p-3 sm:p-4">
        {/* Disclosure. Non-negotiable: this must never read as content. */}
        <div className="pointer-events-auto inline-flex items-center gap-2 rounded-md bg-black/75 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-white backdrop-blur">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent-bright" />
          Ad
        </div>

        {status === "playing" && (
          <div className="pointer-events-auto flex items-center gap-2">
            <button
              type="button"
              onClick={toggleMute}
              aria-label={muted ? "Unmute advertisement" : "Mute advertisement"}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-black/75 text-white backdrop-blur transition-colors hover:bg-black/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-bright"
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
                  : `Skip available in ${Math.max(0, Math.ceil(skipAfterS - elapsed))} seconds`
              }
              className="inline-flex h-9 items-center gap-1.5 rounded-full bg-black/75 px-3 text-xs font-semibold text-white backdrop-blur transition-colors hover:bg-black/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-bright disabled:cursor-not-allowed disabled:opacity-60"
            >
              {canSkip
                ? "Skip Ad"
                : `Skip in ${Math.max(0, Math.ceil(skipAfterS - elapsed))}s`}
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>

      {status === "loading" && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-center p-3 sm:p-4">
          <div className="inline-flex items-center gap-2 rounded-md bg-black/75 px-3 py-1.5 text-[10px] font-medium text-white/85 backdrop-blur">
            {notice ?? "Loading ad…"}
          </div>
        </div>
      )}
    </div>
  );
}

/** Best-effort first-party impression log. Never blocks playback. */
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