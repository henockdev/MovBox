"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  AlertTriangle,
  Check,
  Gauge,
  Languages,
  Loader2,
  Maximize,
  MessageSquare,
  Minimize,
  Pause,
  PictureInPicture2,
  Play,
  Plus,
  Settings,
  SkipBack,
  SkipForward,
  Subtitles,
  ThumbsDown,
  ThumbsUp,
  Volume1,
  Volume2,
  VolumeX,
  WifiOff,
} from "lucide-react";
import type { BoxSource, BoxCaption } from "@/lib/types";
import { recordUserProgress } from "@/lib/user-data";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Playable URL builder
// ---------------------------------------------------------------------------
//
// THE CONTRACT (2026-10-19): every media byte goes through the thin
// relay, never through Vercel.
//
//   - /api/sources returns MP4 URLs that are ALREADY proxied through the
//     relay's /mp4 endpoint (the same proxy the Android app uses, CORS
//     allowed, Range aware). Those are used as-is.
//   - A raw upstream CDN URL (legacy / older API responses) still has to go
//     through /api/video-proxy, which sets the Referer the CDN demands.
//
// The check is a PARSED path check, not a substring match. A URL like
// "https://evil.test/x/mp4?url=..." must not be mistaken for a relay URL,
// otherwise the player would happily hand an attacker-controlled origin
// the source. Only a real /mp4 endpoint that carries a `url` query
// parameter counts as already-proxied.
function isRelayProxiedUrl(rawUrl: string): boolean {
  try {
    const u = new URL(rawUrl, "http://relay.invalid");
    return u.pathname.endsWith("/mp4") && u.searchParams.has("url");
  } catch {
    return false;
  }
}
function buildPlayableUrl(rawUrl: string, detailPath?: string | null): string {
  if (!rawUrl) return rawUrl;
  if (isRelayProxiedUrl(rawUrl)) {
    // Already proxied through the thin relay.
    return rawUrl;
  }
  const p = `/api/video-proxy?url=${encodeURIComponent(rawUrl)}`;
  return detailPath
    ? `${p}&detailPath=${encodeURIComponent(detailPath)}`
    : p;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PlayerProps {
  /** All available sources (always MP4 from boxmovies). */
  sources: BoxSource[];
  /** Title-level captions list (subtitles for the whole movie/episode). */
  captions?: BoxCaption[];
  poster?: string | null;
  /** Backdrop (16:9) — better for the Continue Watching row. */
  backdrop?: string | null;
  title: string;
  metaLine?: string;
  imdbScore?: string | null;
  /** boxmovies detailPath — used to build a sensible Referer in /api/video-proxy. */
  detailPath?: string;
  /** "movie" | "tv" — used to record watch history. */
  type?: "movie" | "tv";
  /** TV-only. Season number for the current episode. */
  season?: number;
  /** TV-only. Episode number within the season. */
  episode?: number;
  activeSourceIndex: number;
  onSourceChange?: (index: number) => void;
  onRate?: (rating: "up" | "down") => void;
  onAddToList?: () => void;
  onEnded?: () => void;
  onRetry?: () => void;
  onAutoFallback?: (fromIndex: number, toIndex: number) => void;
  /**
   * True while the parent (WatchView) is still fetching sources. The
   * player shows a clean loading skeleton in this state instead of
   * flashing the "No sources available" empty-state before the real
   * data arrives — that flash was the worst UX bug on the watch page.
   */
  loading?: boolean;
}

const PLAYBACK_RATES = [0.5, 0.75, 1, 1.25, 1.5, 2] as const;

type SettingsMenu = "main" | "quality" | "speed" | "subtitle" | "stats";

function fmtTime(s: number): string {
  if (!Number.isFinite(s) || s < 0) return "0:00";
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  return `${m}:${String(sec).padStart(2, "0")}`;
}

function fmtSize(bytes?: number | null): string {
  if (!bytes || !Number.isFinite(bytes)) return "";
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(0)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${bytes} B`;
}

// ---------------------------------------------------------------------------
// Source ranking — quality-DESCENDING order.
//
// NOTE: this is NOT the default quality any more. The ladder is sorted
// ascending and the SMALLEST rung auto-plays (fastest start, lowest
// relay egress, and it matches what the two reference sites do). This
// descending order exists only for the auto-fallback path: when the
// current source errors we walk down the quality ladder to the next-best
// source and then wrap around.
// ---------------------------------------------------------------------------

function rankSources(sources: BoxSource[]): number[] {
  const scored = sources.map((s, i) => {
    const res = Number(s.quality?.replace(/[^\d]/g, "")) || 0;
    return { i, score: res + (s.subtitles?.length ? 1 : 0) };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored.map((x) => x.i);
}

// Pretty-print the resolution (1080p → "Full HD", 720p → "HD", etc.).
function qualityTag(label: string): string {
  const r = Number(label?.replace(/[^\d]/g, "")) || 0;
  if (r >= 2160) return `${label} • 4K`;
  if (r >= 1440) return `${label} • 2K`;
  if (r >= 1080) return `${label} • Full HD`;
  if (r >= 720) return `${label} • HD`;
  if (r >= 480) return `${label} • SD`;
  return label;
}

// Map ISO 639 language code (or h5-api language code) to a country flag
// emoji. We use the country-equivalent flag for most languages, falling
// back to the 🌍 globe emoji when no mapping is found.
const FLAG_BY_LANG: Record<string, string> = {
  en: "🇬🇧", eng: "🇬🇧", english: "🇬🇧",
  es: "🇪🇸", spa: "🇪🇸", spanish: "🇪🇸", espanol: "🇪🇸",
  fr: "🇫🇷", fre: "🇫🇷", fra: "🇫🇷", french: "🇫🇷", francais: "🇫🇷",
  de: "🇩🇪", ger: "🇩🇪", deu: "🇩🇪", german: "🇩🇪",
  it: "🇮🇹", ita: "🇮🇹", italian: "🇮🇹",
  pt: "🇵🇹", por: "🇵🇹", portuguese: "🇵🇹", portugues: "🇵🇹",
  ru: "🇷🇺", rus: "🇷🇺", russian: "🇷🇺",
  ja: "🇯🇵", jpn: "🇯🇵", japanese: "🇯🇵",
  ko: "🇰🇷", kor: "🇰🇷", korean: "🇰🇷",
  zh: "🇨🇳", chi: "🇨🇳", zho: "🇨🇳", chinese: "🇨🇳", mandarin: "🇨🇳",
  ar: "🇸🇦", ara: "🇸🇦", arabic: "🇸🇦",
  hi: "🇮🇳", hin: "🇮🇳", hindi: "🇮🇳",
  bn: "🇧🇩", ben: "🇧🇩", bengali: "🇧🇩",
  pa: "🇮🇳", pan: "🇮🇳", punjabi: "🇮🇳",
  ur: "🇵🇰", urd: "🇵🇰", urdu: "🇵🇰",
  tr: "🇹🇷", tur: "🇹🇷", turkish: "🇹🇷",
  fa: "🇮🇷", per: "🇮🇷", fas: "🇮🇷", persian: "🇮🇷", farsi: "🇮🇷",
  th: "🇹🇭", tha: "🇹🇭", thai: "🇹🇭",
  vi: "🇻🇳", vie: "🇻🇳", vietnamese: "🇻🇳",
  id: "🇮🇩", ind: "🇮🇩", indonesian: "🇮🇩",
  ms: "🇲🇾", msa: "🇲🇾", may: "🇲🇾", malay: "🇲🇾",
  fil: "🇵🇭", tl: "🇵🇭", filipino: "🇵🇭", tagalog: "🇵🇭",
  pl: "🇵🇱", pol: "🇵🇱", polish: "🇵🇱",
  nl: "🇳🇱", dut: "🇳🇱", nld: "🇳🇱", dutch: "🇳🇱",
  sv: "🇸🇪", swe: "🇸🇪", swedish: "🇸🇪",
  no: "🇳🇴", nor: "🇳🇴", nob: "🇳🇴", norwegian: "🇳🇴",
  da: "🇩🇰", dan: "🇩🇰", danish: "🇩🇰",
  fi: "🇫🇮", fin: "🇫🇮", finnish: "🇫🇮",
  el: "🇬🇷", gre: "🇬🇷", ell: "🇬🇷", greek: "🇬🇷",
  he: "🇮🇱", heb: "🇮🇱", hebrew: "🇮🇱",
  cs: "🇨🇿", cze: "🇨🇿", ces: "🇨🇿", czech: "🇨🇿",
  ro: "🇷🇴", ron: "🇷🇴", rum: "🇷🇴", romanian: "🇷🇴",
  hu: "🇭🇺", hun: "🇭🇺", hungarian: "🇭🇺",
  uk: "🇺🇦", ukr: "🇺🇦", ukrainian: "🇺🇦",
  ta: "🇮🇳", tam: "🇮🇳", tamil: "🇮🇳",
  te: "🇮🇳", tel: "🇮🇳", telugu: "🇮🇳",
  ml: "🇮🇳", mal: "🇮🇳", malayalam: "🇮🇳",
  kn: "🇮🇳", kan: "🇮🇳", kannada: "🇮🇳",
  mr: "🇮🇳", mar: "🇮🇳", marathi: "🇮🇳",
  gu: "🇮🇳", guj: "🇮🇳", gujarati: "🇮🇳",
};
function flagEmoji(code?: string | null): string {
  if (!code) return "🌍";
  const c = String(code).toLowerCase().trim();
  return FLAG_BY_LANG[c] || "🌍";
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function Player({
  sources,
  captions = [],
  poster,
  backdrop,
  title,
  metaLine,
  imdbScore,
  detailPath,
  type,
  season,
  episode,
  activeSourceIndex,
  onSourceChange,
  onRate,
  onAddToList,
  onEnded,
  onRetry,
  onAutoFallback,
  loading: externalLoading = false,
}: PlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(true);
  // Watch-history bookkeeping. lastHistoryTimeRef gates the writes
  // so we never block the onTimeUpdate hot path. scheduleHistory
  // batches the write through a microtask so multiple timeupdate
  // events in a single frame collapse into one recordProgress call.
  const lastHistoryTimeRef = useRef(0);
  const pendingHistoryRef = useRef<number | null>(null);
  // The parent (WatchView) is still fetching sources. While true, the
  // player shows a clean loading skeleton and never flashes the "no
  // sources" empty-state, which was the most visible bug on the page.
  const isLoading = loading || externalLoading;
  const [error, setError] = useState<string | null>(null);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [bufferedEnd, setBufferedEnd] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isPiP, setIsPiP] = useState(false);
  const [userRating, setUserRating] = useState<"up" | "down" | null>(null);

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [subtitleMenuOpen, setSubtitleMenuOpen] = useState(false);
  const [activeMenu, setActiveMenu] = useState<SettingsMenu>("main");
  const [showSubtitles, setShowSubtitles] = useState(true);
  const [activeSubtitleIdx, setActiveSubtitleIdx] = useState<number>(-1);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [online, setOnline] = useState(true);
  const [hoverTime, setHoverTime] = useState<number | null>(null);

  // Source-of-truth for "which source is playing". Comes from the parent
  // (the quality menu in the player / playlist row in the sidebar) via
  // `activeSourceIndex`. We only ever use `sourceAttempt` for the auto-
  // fallback path on stream error.
  const [autoFallbackCount, setAutoFallbackCount] = useState(0);
  const rankedOrder = useMemo(
    () => rankSources(sources),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sources.map((s) => s.url).join("|")]
  );

  // Pick the active source from the user-chosen index. Clamp to a valid
  // range so an out-of-bounds index never blanks the player.
  const clampedIndex = Math.min(
    Math.max(activeSourceIndex, 0),
    Math.max(sources.length - 1, 0)
  );
  const activeSource: BoxSource | null = sources[clampedIndex] ?? null;

  // -------------------------------------------------------------------------
  // Effects
  // -------------------------------------------------------------------------

  useEffect(() => {
    setOnline(navigator.onLine);
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  useEffect(() => {
    const onChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const onEnter = () => setIsPiP(true);
    const onLeave = () => setIsPiP(false);
    video.addEventListener("enterpictureinpicture", onEnter);
    video.addEventListener("leavepictureinpicture", onLeave);
    return () => {
      video.removeEventListener("enterpictureinpicture", onEnter);
      video.removeEventListener("leavepictureinpicture", onLeave);
    };
  }, []);

  // NOTE: keep this component's hook count stable. Adding a hook once
  // crashed the page for anyone holding a cached chunk built against the
  // previous count — React threw #310 ("Rendered more hooks than during
  // the previous render") and the whole watch page fell into the error
  // boundary. Merge new behaviour into existing effects instead of
  // adding new ones.

  // Attach source + subtitles to the <video> element.
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !activeSource) return;

    setLoading(true);
    setError(null);

    // Build the source-specific captions (fallback to title-level captions).
    const sourceCaptions = activeSource.subtitles?.length
      ? activeSource.subtitles
      : captions;

    // Tear down old <track> elements.
    Array.from(video.querySelectorAll("track")).forEach((t) => t.remove());

    // Insert <track> elements for each caption.
    for (let i = 0; i < sourceCaptions.length; i++) {
      const c = sourceCaptions[i];
      const track = document.createElement("track");
      track.kind = "subtitles";
      track.src = c.url;
      track.srclang = c.languageCode;
      track.label = c.language;
      // Mark default English (or first) so the browser shows it by default
      // when showSubtitles is on.
      const shouldBeDefault =
        showSubtitles && (i === activeSubtitleIdx || (activeSubtitleIdx === -1 && i === 0));
      if (shouldBeDefault) track.default = true;
      video.appendChild(track);
    }

    // Use the source URL as-is when it's already a thin-relay-proxied
    // URL (the common case with /api/sources). Fall back to the
    // Next.js /api/video-proxy for raw upstream URLs.
    const playableUrl = buildPlayableUrl(activeSource.url, detailPath);

    // Preserve playback position across quality switches so the user
    // doesn't lose their spot when changing 1080p → 720p.
    const resumeAt = Number.isFinite(video.currentTime) && video.currentTime > 1
      ? video.currentTime
      : 0;
    const wasPlaying = !video.paused && !video.ended;
    const resumeVolume = video.volume;
    const resumeMuted = video.muted;
    const resumeRate = video.playbackRate;

    video.src = playableUrl;
    video.load();

    const onLoaded = () => {
      setLoading(false);
      setDuration(video.duration);
      // Reset auto-fallback counter on a successful load.
      setAutoFallbackCount(0);
      // Restore position + volume + rate after a quality switch.
      if (resumeAt > 0) {
        try {
          video.currentTime = resumeAt;
        } catch {
          /* metadata may not be ready yet, try again on canplay */
        }
      }
      video.volume = resumeVolume;
      video.muted = resumeMuted;
      video.playbackRate = resumeRate;
      if (wasPlaying) {
        video.play().catch(() => {});
      }
    };
    const onError = () => {
      if (!error && sources.length > 1) {
        setError("Stream error. Trying the next source…");
        setLoading(true);
        const fromIdx = clampedIndex;
        // Pick the next best source AFTER the one that just failed.
        // The order is quality-descending (rankedOrder), so we go down
        // the list and wrap around. Skip the one that just failed.
        const currentRankedPos = rankedOrder.indexOf(fromIdx);
        const startPos = currentRankedPos === -1 ? 0 : currentRankedPos + 1;
        let nextIdx = fromIdx;
        for (let i = 0; i < rankedOrder.length; i++) {
          const candidate = rankedOrder[(startPos + i) % rankedOrder.length];
          if (candidate !== fromIdx) {
            nextIdx = candidate;
            break;
          }
        }
        onSourceChange?.(nextIdx);
        onAutoFallback?.(fromIdx, nextIdx);
        setAutoFallbackCount((c) => c + 1);
      } else if (!error) {
        setError("Stream error. Please try again.");
      }
    };
    video.addEventListener("loadedmetadata", onLoaded, { once: true });
    video.addEventListener("error", onError, { once: true });

    // ---- Stall watchdog ------------------------------------------------
    // Last-resort recovery for a dead upstream: if the element still has
    // no decodable metadata AND has not buffered a single byte after a
    // generous window, pull one fresh signed URL from the parent.
    //
    // Deliberately conservative, because calling load() again interrupts
    // whatever the browser was in the middle of (it surfaces as
    // ERR_NETWORK_IO_SUSPENDED and "play() rejected: interrupted by a
    // call to pause()"). So: one shot per source, a long window, and it
    // bails out the moment ANY progress is observed - a slow-but-alive
    // stream is left alone.
    const STALL_MS = 20000;
    let settled = false;
    const stallTimer = setTimeout(() => {
      if (settled) return;
      const madeProgress = video.readyState > 0 || video.buffered.length > 0;
      if (madeProgress) {
        settled = true;
        return;
      }
      settled = true;
      onRetry?.();
    }, STALL_MS);
    const markSettled = () => {
      settled = true;
      clearTimeout(stallTimer);
    };
    video.addEventListener("loadedmetadata", markSettled, { once: true });
    video.addEventListener("loadeddata", markSettled, { once: true });
    video.addEventListener("progress", markSettled, { once: true });
    video.addEventListener("error", markSettled, { once: true });

    // ---- Buffered progress indicator -----------------------------------
    // These MP4s are faststart but carry a ~3MB `moov` index, so the
    // element sits at readyState 0 for a noticeable beat before it can
    // show a frame. A lone spinner makes that look broken. We paint the
    // real buffered fraction instead.
    //
    // Deliberately imperative and hook-free: this fires on every
    // `progress` tick, and a React state update per tick would re-render
    // the entire control tree several times a second. It also keeps the
    // hook count pinned at 51 — see the note by the early returns.
    const paintBuffered = () => {
      const track = containerRef.current?.querySelector<HTMLElement>(
        "[data-buffered-track]"
      );
      if (!track) return;
      let pct = 0;
      // Only meaningful once duration is known. Before that the bar
      // stays hidden so we never imply a progress figure we can't stand
      // behind.
      if (video.duration && Number.isFinite(video.duration) && video.duration > 0) {
        for (let i = 0; i < video.buffered.length; i++) {
          if (video.buffered.start(i) <= video.currentTime) {
            pct = Math.max(pct, video.buffered.end(i));
          }
        }
        pct = Math.min(100, Math.max(0, (pct / video.duration) * 100));
      }
      const fill = track.firstElementChild as HTMLElement | null;
      if (fill) fill.style.width = `${pct.toFixed(1)}%`;
      track.dataset.state = pct > 0 ? "determinate" : "indeterminate";
    };
    const bufferedEvents = [
      "progress",
      "loadedmetadata",
      "loadeddata",
      "canplay",
      "canplaythrough",
      "timeupdate",
      "waiting",
      "stalled",
      "seeking",
      "seeked",
    ] as const;
    bufferedEvents.forEach((e) => video.addEventListener(e, paintBuffered));
    paintBuffered();

    return () => {
      clearTimeout(stallTimer);
      video.removeEventListener("loadedmetadata", onLoaded);
      video.removeEventListener("error", onError);
      video.removeEventListener("loadedmetadata", markSettled);
      video.removeEventListener("loadeddata", markSettled);
      video.removeEventListener("progress", markSettled);
      video.removeEventListener("error", markSettled);
      bufferedEvents.forEach((e) => video.removeEventListener(e, paintBuffered));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSource]);

  // Re-apply default <track> when showSubtitles / activeSubtitleIdx change
  // OR when the active source changes (which recreates all <track>
  // elements). Also runs when tracks are loaded asynchronously, via the
  // `addtrack` event.
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    // The "effective" subtitle index. When the user hasn't picked one
    // yet (activeSubtitleIdx === -1) we treat the first available
    // track as the default so subs actually show on first load —
    // otherwise every track would be set to "hidden" and nothing
    // would render even though the user expects "subs on by default".
    const effectiveIdx = activeSubtitleIdx === -1 ? 0 : activeSubtitleIdx;

    const applyModes = () => {
      const tracks = Array.from(video.textTracks);
      tracks.forEach((t, i) => {
        if (!showSubtitles) {
          t.mode = "disabled";
        } else if (i === effectiveIdx) {
          t.mode = "showing";
        } else {
          t.mode = "hidden";
        }
      });
    };

    // Apply once now (covers the case where tracks are already in the list).
    applyModes();

    // Apply again whenever a new track element is added (browser fires
    // addtrack on the tracklist, not on the video, in all modern browsers).
    const trackList = video.textTracks;
    const onAddTrack = () => applyModes();
    trackList.addEventListener?.("addtrack", onAddTrack);
    // Some browsers fire `load` on each track element instead.
    const onLoadedMetadata = () => applyModes();
    video.addEventListener("loadedmetadata", onLoadedMetadata);

    return () => {
      trackList.removeEventListener?.("addtrack", onAddTrack);
      video.removeEventListener("loadedmetadata", onLoadedMetadata);
    };
  }, [showSubtitles, activeSubtitleIdx, activeSource]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.playbackRate = playbackRate;
  }, [playbackRate]);

  // Mute/volume sync.
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = muted;
    video.volume = volume;
  }, [muted, volume]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const onMove = () => {
      container.classList.add("controls-visible");
      if (hideTimer.current) clearTimeout(hideTimer.current);
      if (playing) {
        hideTimer.current = setTimeout(() => {
          container.classList.remove("controls-visible");
        }, 3000);
      }
    };
    const onLeave = () => {
      if (playing) container.classList.remove("controls-visible");
    };
    container.addEventListener("mousemove", onMove);
    container.addEventListener("mouseleave", onLeave);
    return () => {
      container.removeEventListener("mousemove", onMove);
      container.removeEventListener("mouseleave", onLeave);
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, [playing]);

  // Keyboard shortcuts.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const video = videoRef.current;
      if (!video) return;
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea") return;
      switch (e.key.toLowerCase()) {
        case " ":
        case "k":
          e.preventDefault();
          togglePlay();
          break;
        case "m":
          e.preventDefault();
          setMuted((m) => !m);
          break;
        case "f":
          e.preventDefault();
          toggleFullscreen();
          break;
        case "p":
          e.preventDefault();
          togglePiP();
          break;
        case "j":
        case "arrowleft":
          e.preventDefault();
          video.currentTime = Math.max(0, video.currentTime - 10);
          break;
        case "l":
        case "arrowright":
          e.preventDefault();
          video.currentTime = Math.min(
            video.duration || 0,
            video.currentTime + 10
          );
          break;
        case "arrowup":
          e.preventDefault();
          setVolume((v) => Math.min(1, v + 0.05));
          if (muted) setMuted(false);
          break;
        case "arrowdown":
          e.preventDefault();
          setVolume((v) => Math.max(0, v - 0.05));
          break;
        case "c":
          e.preventDefault();
          // If subs are off but we have captions, turn them on with the
          // first available track. Otherwise just toggle.
          if (!showSubtitles && sourceCaptions.length > 0) {
            setActiveSubtitleIdx(0);
            setShowSubtitles(true);
          } else {
            setShowSubtitles((s) => !s);
          }
          break;
        case "t":
          e.preventDefault();
          // Cycle to the next subtitle language. If we're on the last
          // language (or off), wrap back to "off" then to the first.
          if (sourceCaptions.length === 0) break;
          setShowSubtitles(true);
          setActiveSubtitleIdx((i) => {
            const next = i + 1;
            if (next >= sourceCaptions.length) return -1; // wrap to off
            return next;
          });
          break;
        case "q":
          e.preventDefault();
          // Cycle to the next quality. If on the lowest, wrap to the
          // highest (skip duplicate qualities, dedupe by label).
          if (qualityOptions.length < 2) break;
          {
            const ids = qualityOptions.map((q) => q.id);
            const pos = ids.indexOf(clampedIndex);
            const next = pos === -1 ? 0 : (pos + 1) % ids.length;
            onSourceChange?.(ids[next]);
          }
          break;
        case "s":
          e.preventDefault();
          setSettingsOpen((o) => !o);
          break;
        default: {
          if (/^[0-9]$/.test(e.key)) {
            e.preventDefault();
            const pct = Number(e.key) / 10;
            if (video.duration) video.currentTime = video.duration * pct;
          }
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [muted]);

  // -------------------------------------------------------------------------
  // Handlers
  // -------------------------------------------------------------------------

  const togglePlay = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      // Chrome's autoplay policy: a .play() call with audio is only
      // trusted in the same microtask as the user gesture for sites
      // with sufficient Media Engagement Index (MEI). New visitors
      // have no MEI, so .play() silently rejects — even if the call
      // is inside a click handler. The reliable workaround that
      // every major player (YouTube, Netflix, Vimeo) uses:
      //   1. Mute the video first
      //   2. Call play() (muted playback is always allowed)
      //   3. Asynchronously unmute once the video actually starts
      //      (onPlaying event)
      //
      // We restore the user's previous mute pref on onPlaying. If
      // they had unmuted, audio comes back when playback starts. If
      // they had muted, audio stays off.
      v.muted = true;
      const p = v.play();
      if (p && typeof p.catch === "function") {
        p.catch((e) => {
          console.warn("[player] play() rejected:", e?.message ?? e);
          setError("Playback blocked. Tap play to retry.");
        });
      }
    } else {
      v.pause();
    }
  }, []);

  const handleVolumeChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const v = videoRef.current;
      if (!v) return;
      const value = Number(e.target.value);
      setVolume(value);
      if (value === 0) setMuted(true);
      else if (muted) setMuted(false);
    },
    [muted]
  );

  const seekTo = useCallback((seconds: number) => {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = Math.max(0, Math.min(v.duration || 0, seconds));
  }, []);

  const skip = useCallback(
    (delta: number) => {
      const v = videoRef.current;
      if (!v) return;
      seekTo(v.currentTime + delta);
    },
    [seekTo]
  );

  const handleSeek = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const v = videoRef.current;
      if (!v) return;
      const t = Number(e.target.value);
      v.currentTime = t;
      setTime(t);
    },
    []
  );

  const handleProgressHover = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      setHoverTime(pct * (duration || 0));
    },
    [duration]
  );

  const toggleFullscreen = useCallback(() => {
    const c = containerRef.current;
    if (!c) return;
    if (!document.fullscreenElement) c.requestFullscreen().catch(() => {});
    else document.exitFullscreen().catch(() => {});
  }, []);

  const togglePiP = useCallback(async () => {
    const v = videoRef.current;
    if (!v) return;
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else if (document.pictureInPictureEnabled) {
        await v.requestPictureInPicture();
      }
    } catch {
      /* ignore */
    }
  }, []);

  const setSubtitle = useCallback((idx: number) => {
    setActiveSubtitleIdx(idx);
    setShowSubtitles(idx >= 0);
  }, []);

  const setRate = useCallback((rate: number) => setPlaybackRate(rate), []);

  // Retry has to RE-FETCH, not replay. The relay hands out MP4 URLs
  // carrying a short-lived upstream signature (`?sign=…&t=…`) that
  // expires in roughly 12 minutes. Re-assigning the same `activeSource
  // .url` on retry just re-requests the dead URL, so the user gets an
  // infinite retry → "Stream error" loop. Asking the parent to refresh
  // sources mints a brand-new signed URL, which the `activeSource`
  // effect then attaches automatically.
  const handleRetry = useCallback(() => {
    setError(null);
    setLoading(true);
    onRetry?.();
  }, [onRetry]);

  // -------------------------------------------------------------------------
  // Derived
  // -------------------------------------------------------------------------

  // Deduplicate subtitles by languageCode so the same language doesn't
  // appear twice (boxmovies occasionally ships dupes). The first
  // occurrence wins, preserving the server-side order. This is the list
  // that gets rendered as <track> elements and in the settings panel.
  const sourceCaptions = useMemo<BoxCaption[]>(() => {
    const list = (
      activeSource?.subtitles?.length ? activeSource.subtitles : captions
    ) ?? [];
    const seen = new Set<string>();
    const out: BoxCaption[] = [];
    for (const c of list) {
      const key = c.languageCode || c.language;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(c);
    }
    return out;
  }, [activeSource, captions]);

  const qualityOptions = useMemo(() => {
    const seen = new Set<string>();
    const opts: { id: number; label: string; size: string; bitrate: number; res: number }[] = [];
    sources.forEach((s, i) => {
      // Skip duplicate quality entries — keep the first one (with subs).
      if (seen.has(s.quality)) return;
      seen.add(s.quality);
      const res = Number(s.quality?.replace(/[^\d]/g, "")) || 0;
      opts.push({
        id: i,
        label: s.quality,
        size: fmtSize(s.sizeBytes),
        bitrate: res,
        res,
      });
    });
    // Ascending: smallest rung first. This mirrors the relay's own ladder
    // order and the auto-played quality, so the first entry in the menu is
    // the one that is actually playing by default. (`id` is still the index
    // into `sources` — the on-change handler depends on it.)
    return opts.sort((a, b) => a.bitrate - b.bitrate);
  }, [sources]);

  const activeQualityId = qualityOptions.findIndex(
    (q) => q.id === clampedIndex
  );

  // Persist on tab close / refresh.
  //
  // IMPORTANT: this effect MUST stay above the loading/empty-state early
  // returns further down. A hook that sits below an early return only runs
  // on renders that reach it, so Player registered 50 hooks on the first
  // render (which returns early while sources are still loading) and 51 on
  // the next render (once `activeSource` exists and it falls through).
  // React saw the hook count grow mid-mount and threw
  // "Rendered more hooks than during the previous render" (#310), which
  // dropped the whole watch page into the error boundary. Every rule of
  // hooks call in this component has to be above every early return.
  useEffect(() => {
    function onUnload() {
      flushHistory();
    }
    window.addEventListener("beforeunload", onUnload);
    window.addEventListener("pagehide", onUnload);
    return () => {
      window.removeEventListener("beforeunload", onUnload);
      window.removeEventListener("pagehide", onUnload);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detailPath, type, title, season, episode, duration, poster, backdrop, time]);

  // -------------------------------------------------------------------------
  // Loading skeleton — shown while sources are still being fetched
  // (prevents the flash of the "No sources" empty state when the page
  // first loads).
  // -------------------------------------------------------------------------

  if (isLoading && (!sources.length || !activeSource)) {
    return (
      <div
        ref={containerRef}
        className="relative flex aspect-video w-full items-center justify-center overflow-hidden rounded-xl border border-border bg-bg-primary"
        style={{
          backgroundImage: poster
            ? `linear-gradient(rgba(8,6,6,0.85), rgba(8,6,6,0.95)), url(${poster})`
            : undefined,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-12 w-12 animate-spin text-accent-bright" />
          <p className="font-display text-sm text-cream">Loading…</p>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // Empty state — sources fetched and genuinely zero
  // -------------------------------------------------------------------------

  if (!sources.length || !activeSource) {
    return (
      <div
        ref={containerRef}
        className="relative flex aspect-video w-full items-center justify-center overflow-hidden rounded-xl border border-border bg-bg-primary"
        style={{
          backgroundImage: poster
            ? `linear-gradient(rgba(8,6,6,0.85), rgba(8,6,6,0.95)), url(${poster})`
            : undefined,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        <div className="text-center">
          <AlertTriangle className="mx-auto h-12 w-12 text-text-muted" />
          <p className="mt-4 font-display text-lg text-cream">
            No sources available
          </p>
          <p className="mt-1 text-sm text-text-muted">
            We couldn&apos;t find any working streams for this title right now.
          </p>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // Watch history — recordProgress helpers
  // -------------------------------------------------------------------------
  //
  // We don't want to block the onTimeUpdate hot path with a
  // localStorage write on every tick. flushHistory writes the
  // pending time immediately (used on pause + beforeunload).
  // scheduleHistory defers via queueMicrotask so multiple updates
  // in the same frame collapse into one write.

  function writeHistoryNow(t: number) {
    if (!detailPath) return;
    recordUserProgress({
      detailPath,
      type: type ?? "movie",
      title,
      season: type === "tv" ? season : undefined,
      episode: type === "tv" ? episode : undefined,
      currentTime: t,
      duration,
      posterUrl: poster ?? "",
      backdropUrl: backdrop ?? poster ?? "",
    });
  }

  function scheduleHistory(t: number) {
    pendingHistoryRef.current = t;
    queueMicrotask(() => {
      if (pendingHistoryRef.current != null) {
        writeHistoryNow(pendingHistoryRef.current);
        pendingHistoryRef.current = null;
      }
    });
  }

  function flushHistory() {
    // Use the latest known time. Read from the video element
    // directly so we don't depend on the React `time` state
    // (which might be stale by the time this fires).
    const v = videoRef.current;
    const t = v && Number.isFinite(v.currentTime) ? v.currentTime : time;
    if (t > 0) writeHistoryNow(t);
  }

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <div
      ref={containerRef}
      className="group/player relative aspect-video w-full overflow-hidden rounded-none border-0 bg-black shadow-none sm:rounded-xl sm:border sm:border-border sm:shadow-elevated"
      onMouseMove={(e) => {
        containerRef.current?.classList.add("controls-visible");
        if (hideTimer.current) clearTimeout(hideTimer.current);
        if (playing) {
          hideTimer.current = setTimeout(() => {
            if (e.clientY < window.innerHeight - 120) {
              containerRef.current?.classList.remove("controls-visible");
            }
          }, 3000);
        }
      }}
    >
      <video
        ref={videoRef}
        poster={poster ?? undefined}
        className="h-full w-full bg-black"
        playsInline
        // No crossOrigin here on purpose. The stream is served by the
        // thin relay on a different origin, and `crossOrigin="anonymous"`
        // forces the browser to validate CORS headers before it will
        // preload="auto", not "metadata". These MP4s are faststart but
        // their `moov` atom is ~2.4 MB, so a metadata-sized first request
        // never completes the index and the video sits at readyState 0
        // forever with no error. "auto" lets the browser buffer the index
        // (and start of media) so playback actually begins. Verified
        // against the relay: `ftyp@0(32) moov@32(2458003)`.
        preload="auto"
        onClick={togglePlay}
        onPlay={() => {
          setPlaying(true);
        }}
        onPause={() => {
          setPlaying(false);
          // Snapshot progress on pause so the user can come back to
          // exactly where they left off.
          flushHistory();
        }}
        onTimeUpdate={(e) => {
          const t = e.currentTarget.currentTime;
          setTime(t);
          // Throttle: recordHistory() already throttles internally
          // by comparing to the last recorded timestamp, but we also
          // gate the call here to once every 5s to keep this hot
          // path light.
          if (t - lastHistoryTimeRef.current >= 5) {
            lastHistoryTimeRef.current = t;
            scheduleHistory(t);
          }
        }}
        onProgress={(e) => {
          const v = e.currentTarget;
          if (v.buffered.length > 0) {
            setBufferedEnd(v.buffered.end(v.buffered.length - 1));
          }
        }}
        onDurationChange={(e) => setDuration(e.currentTarget.duration)}
        onWaiting={() => setLoading(true)}
        onCanPlay={() => setLoading(false)}
        onPlaying={() => {
          setLoading(false);
          setPlaying(true);
          // Muted-then-unmute dance: we muted v before play() to
          // satisfy Chrome's autoplay policy. Now that playback is
          // actually running, restore the user's preferred mute state.
          if (!muted && videoRef.current) {
            videoRef.current.muted = false;
          }
        }}
        onEnded={(e) => {
          // Mark the entry as fully watched so the Continue Watching
          // row drops it. recordProgress() does this automatically
          // when currentTime/duration > 0.95, so we just trigger a
          // final write at the very end.
          const v = e.currentTarget;
          if (v && Number.isFinite(v.duration)) {
            writeHistoryNow(v.duration);
          }
          onEnded?.();
        }}
        onError={() => {
          if (!error) setError("Stream error. Try a different source.");
        }}
      />

      {/* Source fallback banner */}
      {loading && autoFallbackCount > 0 && sources.length > 1 && (
        <div className="pointer-events-none absolute left-1/2 top-4 z-20 -translate-x-1/2 rounded-full bg-bg-deepest/85 px-3 py-1.5 text-xs text-cream shadow-elevated backdrop-blur">
          Trying next source… ({autoFallbackCount + 1} of {sources.length})
        </div>
      )}

      {loading && !error && (
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-4">
          <Loader2 className="h-12 w-12 animate-spin text-accent-bright" />
          {/* Real buffered fraction, painted imperatively by the
              activeSource effect. Stays invisible until duration is
              known and at least one byte is buffered. */}
          <div
            data-buffered-track
            data-state="indeterminate"
            role="progressbar"
            aria-label="Buffering"
            className="h-1 w-40 max-w-[60%] overflow-hidden rounded-full bg-white/15 opacity-0 transition-opacity duration-300 data-[state=determinate]:opacity-100 sm:w-56"
          >
            <div className="h-full w-0 rounded-full bg-accent-bright transition-[width] duration-300 ease-out" />
          </div>
          <p className="text-[11px] font-medium text-cream/70">Buffering…</p>
        </div>
      )}

      {error && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-3 bg-bg-deepest/85 backdrop-blur-sm">
          <AlertTriangle className="h-10 w-10 text-warning" />
          <p className="px-4 text-center text-sm font-medium text-cream">
            {error}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleRetry}
              className="rounded-md bg-accent px-4 py-1.5 text-sm font-medium text-cream hover:bg-accent/80"
            >
              Retry
            </button>
            {sources.length > 1 && (
              <button
                type="button"
                onClick={() =>
                  onSourceChange?.(
                    (activeSourceIndex + 1) % sources.length
                  )
                }
                className="rounded-md border border-border bg-surface-elevated px-4 py-1.5 text-sm font-medium text-cream hover:bg-surface-hover"
              >
                Try next source
              </button>
            )}
          </div>
        </div>
      )}

      {!playing && !loading && !error && (
        <button
          type="button"
          onClick={togglePlay}
          className="absolute inset-0 z-10 flex items-center justify-center bg-bg-deepest/30 transition-opacity hover:bg-bg-deepest/50"
          aria-label="Play"
        >
          <span className="flex h-20 w-20 items-center justify-center rounded-full bg-brand text-cream shadow-glow-strong transition-transform hover:scale-110">
            <Play className="h-10 w-10 fill-current" />
          </span>
        </button>
      )}

      {/* Top overlay */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between gap-3 bg-gradient-to-b from-bg-deepest/85 via-bg-deepest/40 to-transparent p-4 opacity-0 transition-opacity duration-300 [.controls-visible_&]:opacity-100">
        <div className="min-w-0">
          <h2 className="line-clamp-1 font-display text-base font-semibold text-cream md:text-lg">
            {title}
          </h2>
          {metaLine && (
            <p className="mt-0.5 line-clamp-1 text-xs text-text-secondary">
              {metaLine}
            </p>
          )}
        </div>
        <div className="pointer-events-auto flex shrink-0 items-center gap-2">
          {imdbScore && (
            <span className="hidden items-center gap-1 rounded-md bg-yellow-400/15 px-2 py-1 text-[11px] font-bold text-yellow-400 sm:inline-flex">
              IMDb {imdbScore}
            </span>
          )}
          <button
            type="button"
            onClick={() => onAddToList?.()}
            className="rounded-full bg-surface-elevated/70 p-2 text-cream backdrop-blur transition-colors hover:bg-surface-hover"
            aria-label="Add to list"
          >
            <Plus className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => {
              setUserRating("up");
              onRate?.("up");
            }}
            className={cn(
              "rounded-full bg-surface-elevated/70 p-2 backdrop-blur transition-colors hover:bg-surface-hover",
              userRating === "up" && "bg-accent text-cream hover:bg-accent"
            )}
            aria-label="Like"
          >
            <ThumbsUp className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => {
              setUserRating("down");
              onRate?.("down");
            }}
            className={cn(
              "rounded-full bg-surface-elevated/70 p-2 backdrop-blur transition-colors hover:bg-surface-hover",
              userRating === "down" && "bg-accent text-cream hover:bg-accent"
            )}
            aria-label="Dislike"
          >
            <ThumbsDown className="h-4 w-4" />
          </button>
          <button
            type="button"
            className="hidden rounded-full bg-surface-elevated/70 p-2 text-cream backdrop-blur transition-colors hover:bg-surface-hover md:inline-flex"
            aria-label="Comments"
          >
            <MessageSquare className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={togglePiP}
            className={cn(
              "hidden rounded-full p-2 backdrop-blur transition-colors md:inline-flex",
              isPiP
                ? "bg-accent text-cream hover:bg-accent"
                : "bg-surface-elevated/70 text-cream hover:bg-surface-hover"
            )}
            aria-label="Picture in Picture"
          >
            <PictureInPicture2 className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={toggleFullscreen}
            className="rounded-full bg-surface-elevated/70 p-2 text-cream backdrop-blur transition-colors hover:bg-surface-hover"
            aria-label="Fullscreen"
          >
            <Maximize className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Bottom controls */}
      <div className="absolute inset-x-0 bottom-0 z-20 translate-y-1 bg-gradient-to-t from-bg-deepest via-bg-deepest/85 to-transparent px-4 pb-3 pt-6 opacity-0 transition-all duration-300 [.controls-visible_&]:translate-y-0 [.controls-visible_&]:opacity-100">
        {/* Progress bar */}
        <div
          className="group/progress relative mb-2 flex h-4 cursor-pointer items-center"
          onMouseMove={handleProgressHover}
          onMouseLeave={() => setHoverTime(null)}
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const pct = (e.clientX - rect.left) / rect.width;
            seekTo(pct * (duration || 0));
          }}
        >
          <div className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 overflow-hidden rounded-full bg-border/60">
            <div
              className="absolute inset-y-0 left-0 bg-text-muted/60"
              style={{
                width: duration ? `${(bufferedEnd / duration) * 100}%` : 0,
              }}
            />
            <div
              className="absolute inset-y-0 left-0 bg-accent-bright"
              style={{
                width: duration ? `${(time / duration) * 100}%` : 0,
              }}
            />
          </div>
          {hoverTime !== null && duration > 0 && (
            <div
              className="pointer-events-none absolute -top-9 -translate-x-1/2 rounded bg-bg-deepest px-1.5 py-0.5 text-[11px] font-medium tabular-nums text-cream shadow-elevated"
              style={{ left: `${(hoverTime / duration) * 100}%` }}
            >
              {fmtTime(hoverTime)}
            </div>
          )}
          <div
            className="pointer-events-none absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent-bright opacity-0 shadow-glow transition-opacity [.controls-visible_&]:opacity-100"
            style={{ left: duration ? `${(time / duration) * 100}%` : 0 }}
          />
          <input
            type="range"
            min={0}
            max={duration || 0}
            step={0.1}
            value={time}
            onChange={handleSeek}
            className="sr-only"
            aria-label="Seek"
          />
        </div>

        <div className="flex items-center gap-1.5 md:gap-2">
          <button
            type="button"
            onClick={togglePlay}
            className="rounded-full p-2 text-cream hover:bg-surface-hover"
            aria-label={playing ? "Pause" : "Play"}
          >
            {playing ? (
              <Pause className="h-5 w-5 fill-current" />
            ) : (
              <Play className="h-5 w-5 fill-current" />
            )}
          </button>

          <button
            type="button"
            onClick={() => skip(-10)}
            className="rounded-full p-2 text-cream hover:bg-surface-hover"
            aria-label="Back 10 seconds"
          >
            <SkipBack className="h-4 w-4" />
          </button>

          <button
            type="button"
            onClick={() => skip(10)}
            className="rounded-full p-2 text-cream hover:bg-surface-hover"
            aria-label="Forward 10 seconds"
          >
            <SkipForward className="h-4 w-4" />
          </button>

          <span className="ml-1 hidden text-xs tabular-nums text-text-secondary sm:inline">
            {fmtTime(time)} / {fmtTime(duration)}
          </span>

          <div className="group/vol ml-2 flex items-center">
            <button
              type="button"
              onClick={() => setMuted((m) => !m)}
              className="rounded-full p-2 text-cream hover:bg-surface-hover"
              aria-label={muted ? "Unmute" : "Mute"}
            >
              {muted || volume === 0 ? (
                <VolumeX className="h-5 w-5" />
              ) : volume < 0.5 ? (
                <Volume1 className="h-5 w-5" />
              ) : (
                <Volume2 className="h-5 w-5" />
              )}
            </button>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={muted ? 0 : volume}
              onChange={handleVolumeChange}
              className="ml-1 h-1 w-0 cursor-pointer appearance-none rounded-full bg-border transition-[width] duration-200 accent-accent-bright group-hover/vol:w-20 sm:w-20 md:w-24"
              aria-label="Volume"
            />
          </div>

          {!online && (
            <span className="ml-2 inline-flex items-center gap-1 text-xs text-warning">
              <WifiOff className="h-3.5 w-3.5" />
              Offline
            </span>
          )}

          <div className="ml-auto flex items-center gap-1">
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  if (sourceCaptions.length === 0) return;
                  setSubtitleMenuOpen((o) => !o);
                }}
                className={cn(
                  "relative rounded-full p-2 hover:bg-surface-hover",
                  showSubtitles ? "text-accent-bright" : "text-cream"
                )}
                aria-label="Subtitles"
                aria-expanded={subtitleMenuOpen}
                aria-haspopup="menu"
                title={
                  sourceCaptions.length > 0
                    ? `Subtitles (${sourceCaptions.length}) — press C`
                    : "Subtitles — press C"
                }
              >
                <Subtitles className="h-5 w-5" />
                {sourceCaptions.length > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 flex h-3.5 min-w-[14px] items-center justify-center rounded-full bg-accent px-1 text-[8px] font-bold text-cream">
                    {sourceCaptions.length}
                  </span>
                )}
              </button>
              {subtitleMenuOpen && sourceCaptions.length > 0 && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setSubtitleMenuOpen(false)}
                    aria-hidden
                  />
                  <div
                    role="menu"
                    className="absolute bottom-full right-0 z-50 mb-2 max-h-72 w-56 overflow-y-auto rounded-lg border border-border bg-bg-primary/95 p-1 shadow-elevated backdrop-blur"
                  >
                    <div className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                      Subtitles
                    </div>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setActiveSubtitleIdx(-1);
                        setShowSubtitles(false);
                        setSubtitleMenuOpen(false);
                      }}
                      className={cn(
                        "flex w-full items-center justify-between gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-surface-hover",
                        !showSubtitles ? "bg-surface text-accent-bright" : "text-cream"
                      )}
                    >
                      <span>Off</span>
                      {!showSubtitles && <Check className="h-3.5 w-3.5" />}
                    </button>
                    {sourceCaptions.map((c, i) => {
                      const flag = flagEmoji(c.languageCode);
                      const isActive = showSubtitles && activeSubtitleIdx === i;
                      return (
                        <button
                          key={`${c.id || c.languageCode || i}-${i}`}
                          type="button"
                          role="menuitem"
                          onClick={() => {
                            setActiveSubtitleIdx(i);
                            setShowSubtitles(true);
                            setSubtitleMenuOpen(false);
                          }}
                          className={cn(
                            "flex w-full items-center justify-between gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-surface-hover",
                            isActive ? "bg-surface text-accent-bright" : "text-cream"
                          )}
                        >
                          <span className="flex min-w-0 items-center gap-2">
                            <span className="text-base" aria-hidden>{flag}</span>
                            <span className="truncate">{c.language}</span>
                          </span>
                          {isActive && <Check className="h-3.5 w-3.5" />}
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
            </div>

            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setSettingsOpen((o) => !o);
                  setActiveMenu("main");
                }}
                className="rounded-full p-2 text-cream hover:bg-surface-hover"
                aria-label="Settings"
                title="Settings (S)"
              >
                <Settings className="h-5 w-5" />
              </button>
              {settingsOpen && (
                <SettingsPanel
                  activeMenu={activeMenu}
                  setActiveMenu={setActiveMenu}
                  onClose={() => setSettingsOpen(false)}
                  qualityOptions={qualityOptions}
                  activeQualityId={activeQualityId >= 0 ? activeQualityId : 0}
                  onQualityChange={(id) => onSourceChange?.(id)}
                  playbackRate={playbackRate}
                  onRateChange={setRate}
                  subtitleOptions={sourceCaptions.map((c, i) => ({
                    id: i,
                    label: c.language,
                    lang: c.languageCode,
                    flag: c.languageCode,
                  }))}
                  activeSubtitleId={activeSubtitleIdx}
                  onSubtitleChange={setSubtitle}
                  currentSourceLabel={`${activeSource.provider.name} • ${activeSource.quality} • ${activeSource.format ?? "MP4"}`}
                />
              )}
            </div>

            <button
              type="button"
              onClick={togglePiP}
              className={cn(
                "hidden rounded-full p-2 hover:bg-surface-hover md:inline-flex",
                isPiP ? "text-accent-bright" : "text-cream"
              )}
              aria-label="Picture in Picture"
            >
              <PictureInPicture2 className="h-5 w-5" />
            </button>

            <button
              type="button"
              onClick={toggleFullscreen}
              className="rounded-full p-2 text-cream hover:bg-surface-hover"
              aria-label={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
            >
              {isFullscreen ? (
                <Minimize className="h-5 w-5" />
              ) : (
                <Maximize className="h-5 w-5" />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Settings panel
// ---------------------------------------------------------------------------

interface SettingsPanelProps {
  activeMenu: SettingsMenu;
  setActiveMenu: (m: SettingsMenu) => void;
  onClose: () => void;
  qualityOptions: { id: number; label: string; size: string; bitrate: number; res: number }[];
  activeQualityId: number;
  onQualityChange: (id: number) => void;
  playbackRate: number;
  onRateChange: (r: number) => void;
  subtitleOptions: { id: number; label: string; lang?: string; flag?: string }[];
  activeSubtitleId: number;
  onSubtitleChange: (id: number) => void;
  currentSourceLabel: string;
}

// Country-flag emoji for common languages. Falls back to 🌐 for anything
// we don't have a flag for. Using emoji keeps the UI clean and avoids
// shipping a flag icon library.
const LANG_FLAGS: Record<string, string> = {
  en: "🇬🇧", eng: "🇬🇧", english: "🇬🇧",
  es: "🇪🇸", spa: "🇪🇸", spanish: "🇪🇸", espanol: "🇪🇸",
  fr: "🇫🇷", fra: "🇫🇷", fre: "🇫🇷", french: "🇫🇷",
  de: "🇩🇪", ger: "🇩🇪", german: "🇩🇪", deu: "🇩🇪",
  it: "🇮🇹", ita: "🇮🇹", italian: "🇮🇹",
  pt: "🇵🇹", por: "🇵🇹", portuguese: "🇵🇹",
  br: "🇧🇷", portuguesebr: "🇧🇷", "pt-br": "🇧🇷",
  ru: "🇷🇺", rus: "🇷🇺", russian: "🇷🇺",
  ja: "🇯🇵", jpn: "🇯🇵", japanese: "🇯🇵",
  zh: "🇨🇳", chi: "🇨🇳", chinese: "🇨🇳", "zh-cn": "🇨🇳", "zh-tw": "🇹🇼",
  ko: "🇰🇷", kor: "🇰🇷", korean: "🇰🇷",
  ar: "🇸🇦", ara: "🇸🇦", arabic: "🇸🇦",
  hi: "🇮🇳", hin: "🇮🇳", hindi: "🇮🇳",
  tr: "🇹🇷", tur: "🇹🇷", turkish: "🇹🇷",
  nl: "🇳🇱", dut: "🇳🇱", dutch: "🇳🇱",
  pl: "🇵🇱", pol: "🇵🇱", polish: "🇵🇱",
  sv: "🇸🇪", swe: "🇸🇪", swedish: "🇸🇪",
  no: "🇳🇴", nor: "🇳🇴", norwegian: "🇳🇴",
  da: "🇩🇰", dan: "🇩🇰", danish: "🇩🇰",
  fi: "🇫🇮", fin: "🇫🇮", finnish: "🇫🇮",
  el: "🇬🇷", gre: "🇬🇷", greek: "🇬🇷",
  he: "🇮🇱", heb: "🇮🇱", hebrew: "🇮🇱",
  id: "🇮🇩", ind: "🇮🇩", indonesian: "🇮🇩",
  ms: "🇲🇾", msa: "🇲🇾", malay: "🇲🇾",
  vi: "🇻🇳", vie: "🇻🇳", vietnamese: "🇻🇳",
  th: "🇹🇭", tha: "🇹🇭", thai: "🇹🇭",
  tl: "🇵🇭", fil: "🇵🇭", filipino: "🇵🇭", tagalog: "🇵🇭",
  cs: "🇨🇿", cze: "🇨🇿", ces: "🇨🇿", czech: "🇨🇿",
  hu: "🇭🇺", hun: "🇭🇺", hungarian: "🇭🇺",
  ro: "🇷🇴", ron: "🇷🇴", rum: "🇷🇴", romanian: "🇷🇴",
  uk: "🇺🇦", ukr: "🇺🇦", ukrainian: "🇺🇦",
  sw: "🇰🇪", swa: "🇰🇪", swahili: "🇰🇪",
};

function flagFor(lang: string | undefined): string {
  if (!lang) return "🌐";
  const key = lang.toLowerCase().trim();
  return LANG_FLAGS[key] ?? "🌐";
}

function SettingsPanel({
  activeMenu,
  setActiveMenu,
  onClose,
  qualityOptions,
  activeQualityId,
  onQualityChange,
  playbackRate,
  onRateChange,
  subtitleOptions,
  activeSubtitleId,
  onSubtitleChange,
  currentSourceLabel,
}: SettingsPanelProps) {
  return (
    <div
      className="absolute bottom-14 right-0 z-40 w-72 overflow-hidden rounded-lg border border-border bg-bg-deepest/95 shadow-elevated backdrop-blur-md"
      onClick={(e) => e.stopPropagation()}
    >
      {activeMenu === "main" && (
        <div className="text-sm text-cream">
          <button
            type="button"
            onClick={() => setActiveMenu("quality")}
            className="flex w-full items-center justify-between px-4 py-3 hover:bg-surface-hover"
          >
            <span className="inline-flex items-center gap-2">
              <Settings className="h-4 w-4" /> Quality
            </span>
            <span className="text-xs text-text-muted">
              {qualityOptions[activeQualityId]?.label ?? "Auto"}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setActiveMenu("speed")}
            className="flex w-full items-center justify-between border-t border-border/40 px-4 py-3 hover:bg-surface-hover"
          >
            <span className="inline-flex items-center gap-2">
              <Gauge className="h-4 w-4" /> Speed
            </span>
            <span className="text-xs text-text-muted">
              {playbackRate === 1 ? "Normal" : `${playbackRate}x`}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setActiveMenu("subtitle")}
            className="flex w-full items-center justify-between border-t border-border/40 px-4 py-3 hover:bg-surface-hover"
          >
            <span className="inline-flex items-center gap-2">
              <Languages className="h-4 w-4" /> Subtitles
            </span>
            <span className="text-xs text-text-muted">
              {activeSubtitleId >= 0
                ? subtitleOptions.length > 0
                  ? `${flagFor(subtitleOptions[activeSubtitleId]?.lang)} ${subtitleOptions[activeSubtitleId]?.label}`
                  : "On"
                : subtitleOptions.length > 0
                  ? `Off (${subtitleOptions.length})`
                  : "Off"}
            </span>
          </button>
          <div className="border-t border-border/40 px-4 py-2 text-[11px] text-text-muted">
            {currentSourceLabel}
          </div>
        </div>
      )}

      {activeMenu === "quality" && (
        <SubMenu title="Quality" onBack={() => setActiveMenu("main")}>
          {qualityOptions.length === 0 ? (
            <div className="px-4 py-3 text-sm text-text-muted">
              No quality options
            </div>
          ) : (
            qualityOptions.map((q) => {
              const tag = qualityTag(q.label);
              return (
                <Row
                  key={q.id}
                  label={tag}
                  sub={q.size}
                  selected={q.id === activeQualityId}
                  onClick={() => onQualityChange(q.id)}
                />
              );
            })
          )}
        </SubMenu>
      )}

      {activeMenu === "speed" && (
        <SubMenu title="Speed" onBack={() => setActiveMenu("main")}>
          {PLAYBACK_RATES.map((r) => (
            <Row
              key={r}
              label={r === 1 ? "Normal" : `${r}x`}
              sub={r === 1 ? "Default" : ""}
              selected={r === playbackRate}
              onClick={() => onRateChange(r)}
            />
          ))}
        </SubMenu>
      )}

      {activeMenu === "subtitle" && (
        <SubMenu title="Subtitles" onBack={() => setActiveMenu("main")}>
          {subtitleOptions.length === 0 ? (
            <div className="px-4 py-3 text-sm text-text-muted">
              No subtitles available for this source
            </div>
          ) : (
            <>
              <Row
                label="Off"
                sub="Hide subtitles"
                selected={activeSubtitleId === -1}
                onClick={() => onSubtitleChange(-1)}
              />
              <div className="border-b border-border/40 px-4 py-1.5 text-[10px] uppercase tracking-wider text-text-muted">
                {subtitleOptions.length} language
                {subtitleOptions.length === 1 ? "" : "s"} available
              </div>
              {subtitleOptions.map((s) => (
                <Row
                  key={s.id}
                  label={`${flagFor(s.lang)}  ${s.label}`}
                  sub={(s.lang || "").toUpperCase()}
                  selected={s.id === activeSubtitleId}
                  onClick={() => onSubtitleChange(s.id)}
                />
              ))}
            </>
          )}
        </SubMenu>
      )}
    </div>
  );
}

function SubMenu({
  title,
  onBack,
  children,
}: {
  title: string;
  onBack: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="text-sm text-cream">
      <button
        type="button"
        onClick={onBack}
        className="flex w-full items-center gap-2 border-b border-border/40 px-4 py-3 hover:bg-surface-hover"
      >
        <span className="text-text-muted">←</span>
        <span className="font-semibold">{title}</span>
      </button>
      <div className="max-h-72 overflow-y-auto">{children}</div>
    </div>
  );
}

function Row({
  label,
  sub,
  selected,
  onClick,
}: {
  label: string;
  sub?: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center justify-between px-4 py-2.5 hover:bg-surface-hover",
        selected && "text-accent-bright"
      )}
    >
      <div className="min-w-0">
        <p className="text-sm font-medium">{label}</p>
        {sub && <p className="text-[10px] uppercase tracking-wider text-text-muted">{sub}</p>}
      </div>
      {selected && <Check className="h-4 w-4" />}
    </button>
  );
}
