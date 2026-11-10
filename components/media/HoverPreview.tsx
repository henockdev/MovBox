"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import Image from "next/image";
import { Play, Star, Volume2, VolumeX } from "lucide-react";
import { formatRating, formatYear } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * What the preview needs to know about a title.
 *
 * `MediaCard` and `SearchCard` both satisfy it, so the same preview plays
 * on a catalogue card and on a search result row.
 */
export interface PreviewMedia {
  id: string;
  type: "movie" | "tv";
  title: string;
  year: string;
  rating: number;
  posterPath: string | null;
  backdropPath: string | null;
  overview?: string;
  trailerUrl?: string | null;
  trailerPosterUrl?: string | null;
  country?: string | null;
  genres?: string[];
}

/**
 * The hover preview — the app's card popup, on the web.
 *
 * Hovering a poster pops a small player above the card: the title's OWN
 * trailer (a per-title MP4 the catalogue already publishes on every list
 * response), the title, its rating / year / country / genres, and a Play
 * button.
 *
 * ## Why there is no extra upstream call
 *
 * The upstream's list endpoints publish `trailer.videoAddress.url` on every
 * item, so the card already carries the video. Hovering costs nothing but
 * the video itself — no detail lookup, no rate-limit exposure.
 *
 * ## Why it is a portal
 *
 * The cards live inside horizontal scroll rows (`overflow-x-auto`) and
 * inside grids. An absolutely positioned panel inside either would be
 * clipped by the scroll container, so the panel is rendered into
 * `document.body` and positioned against the card's viewport rect.
 *
 * ## Bandwidth
 *
 * The video element only exists while the panel is open, and it is
 * removed the moment the pointer leaves — which cancels the download. The
 * clip loops its first seconds rather than playing the whole trailer.
 */

const PANEL_MAX_WIDTH = 380;
const EDGE = 12;
const GAP = 10;
/** How long the preview plays before it loops back to the start. */
const LOOP_SECONDS = 20;
/**
 * How long the panel survives the pointer leaving the card.
 *
 * The panel sits ABOVE the card, so moving the pointer onto it crosses a
 * gap where it is over neither. This grace period covers that crossing.
 */
const CLOSE_GRACE_MS = 250;

/**
 * The hover state a card needs: the anchor ref, whether the panel is open,
 * and the handlers that open and close it.
 *
 * The panel only opens on a device that can actually hover — on a touch
 * screen a tap must navigate, not pop a panel over the finger.
 */
export function useHoverPreview<T extends HTMLElement>() {
  const anchorRef = useRef<T>(null);
  const [open, setOpen] = useState(false);
  const [hoverCapable, setHoverCapable] = useState(false);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    const mq = window.matchMedia("(hover: hover) and (pointer: fine)");
    const update = () => setHoverCapable(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  const cancelClose = useCallback(() => {
    if (timer.current !== null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
  }, []);

  const openNow = useCallback(() => {
    if (!hoverCapable) return;
    cancelClose();
    setOpen(true);
  }, [hoverCapable, cancelClose]);

  const closeSoon = useCallback(() => {
    cancelClose();
    timer.current = window.setTimeout(() => {
      setOpen(false);
      timer.current = null;
    }, CLOSE_GRACE_MS);
  }, [cancelClose]);

  useEffect(() => () => cancelClose(), [cancelClose]);

  // Escape closes it — a keyboard user who opened it with the mouse can
  // dismiss it without reaching for the pointer.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return { anchorRef, open, openNow, closeSoon, cancelClose };
}


interface HoverPreviewProps {
  media: PreviewMedia;
  /** The element the panel is anchored to. */
  anchorRef: React.RefObject<HTMLElement | null>;
  open: boolean;
  /** Called when the pointer enters the panel (it must stay open). */
  onPanelEnter: () => void;
  /** Called when the pointer leaves the panel. */
  onPanelLeave: () => void;
}

export function HoverPreview({
  media,
  anchorRef,
  open,
  onPanelEnter,
  onPanelLeave,
}: HoverPreviewProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [muted, setMuted] = useState(true);
  const [progress, setProgress] = useState(0);
  const [pos, setPos] = useState<{
    top: number;
    left: number;
    width: number;
  } | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  // ---- placement -----------------------------------------------------------
  useEffect(() => {
    if (!open) {
      setPos(null);
      return;
    }
    const place = () => {
      const el = anchorRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const width = Math.min(PANEL_MAX_WIDTH, Math.max(240, vw - EDGE * 2));
      const infoHeight = 108;
      const height = Math.round(width * (9 / 16)) + infoHeight;

      let left = r.left + r.width / 2 - width / 2;
      left = Math.max(EDGE, Math.min(left, vw - width - EDGE));

      // Above the card when there is room, below it when there is not.
      let top = r.top - height - GAP;
      if (top < EDGE) top = Math.min(r.bottom + GAP, vh - height - EDGE);

      setPos({ top: Math.max(EDGE, top), left, width });
    };
    place();
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => {
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
  }, [open, anchorRef]);

  // ---- the video -----------------------------------------------------------
  useEffect(() => {
    if (!open) {
      setProgress(0);
      return;
    }
    const v = videoRef.current;
    if (!v) return;
    v.muted = muted;
    const play = v.play();
    if (play && typeof play.catch === "function") {
      // A browser may refuse to autoplay. The poster frame stays visible,
      // so the panel still reads as a preview.
      play.catch(() => {});
    }
  }, [open, muted]);

  const onTimeUpdate = useCallback(() => {
    const v = videoRef.current;
    if (!v || !v.duration) return;
    if (v.currentTime >= LOOP_SECONDS) {
      v.currentTime = 0;
      void v.play().catch(() => {});
      return;
    }
    setProgress(v.currentTime / Math.min(v.duration, LOOP_SECONDS));
  }, []);

  if (!mounted || !open || !pos) return null;

  const href =
    media.type === "movie"
      ? `/watch/movie/${encodeURIComponent(media.id)}`
      : `/tv/${encodeURIComponent(media.id)}`;

  const meta = [
    media.rating > 0 ? formatRating(media.rating) : null,
    formatYear(media.year) || null,
    media.country || null,
    media.genres?.length ? media.genres.slice(0, 3).join(", ") : null,
  ].filter(Boolean) as string[];

  return createPortal(
    <div
      className="pointer-events-none fixed z-[70]"
      style={{ top: pos.top, left: pos.left, width: pos.width }}
      onMouseEnter={onPanelEnter}
      onMouseLeave={onPanelLeave}
    >
      <div
        className={cn(
          "preview-pop pointer-events-auto overflow-hidden rounded-xl border border-border-strong bg-bg-deepest/95 shadow-2xl backdrop-blur-md"
        )}
        style={{ boxShadow: "0 24px 60px rgba(0,0,0,0.65)" }}
      >
        {/* ---- the video ---- */}
        <div className="relative aspect-video w-full overflow-hidden bg-black">
          {media.trailerUrl ? (
            <video
              ref={videoRef}
              src={media.trailerUrl}
              poster={media.trailerPosterUrl ?? undefined}
              muted={muted}
              autoPlay
              loop
              playsInline
              preload="metadata"
              onTimeUpdate={onTimeUpdate}
              className="h-full w-full object-cover"
            />
          ) : (
            (media.backdropPath || media.posterPath) && (
              <Image
                src={media.backdropPath || media.posterPath}
                alt=""
                fill
                sizes="380px"
                className="h-full w-full object-cover"
              />
            )
          )}

          {/* Vignette + a warm brand wash over the footage */}
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "radial-gradient(ellipse at 50% 50%, transparent 45%, rgba(8,6,6,0.55) 100%)",
            }}
          />

          {/* Mute toggle */}
          <button
            type="button"
            onClick={() => setMuted((m) => !m)}
            aria-label={muted ? "Unmute trailer" : "Mute trailer"}
            className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-md bg-black/55 text-cream/90 backdrop-blur-sm transition-colors hover:bg-black/80"
          >
            {muted ? (
              <VolumeX className="h-3.5 w-3.5" />
            ) : (
              <Volume2 className="h-3.5 w-3.5" />
            )}
          </button>

          {/* Progress line */}
          <div className="absolute inset-x-0 bottom-0 h-[3px] bg-white/15">
            <div
              className="h-full bg-accent-bright transition-[width] duration-150"
              style={{ width: `${Math.min(100, progress * 100)}%` }}
            />
          </div>
        </div>

        {/* ---- the info bar ---- */}
        <div className="px-3 py-2.5">
          <h4 className="line-clamp-1 font-display text-sm font-bold text-cream">
            {media.title}
          </h4>
          {meta.length > 0 && (
            <p className="mt-1 line-clamp-1 flex items-center gap-1 text-[11px] text-text-secondary">
              {media.rating > 0 && (
                <span className="inline-flex items-center gap-0.5 font-semibold text-yellow-400">
                  <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                  {formatRating(media.rating)}
                </span>
              )}
              {meta.length > 0 && <span className="text-text-muted">·</span>}
              <span className="truncate">{meta.slice(media.rating > 0 ? 1 : 0).join(" · ")}</span>
            </p>
          )}
          <div className="mt-2.5 flex items-center gap-2">
            <Link
              href={href}
              className="inline-flex items-center gap-1.5 rounded-full bg-brand px-3.5 py-1.5 text-xs font-semibold text-cream shadow-glow transition-colors hover:bg-accent"
            >
              <Play className="h-3 w-3 fill-current" />
              Play
            </Link>
            <Link
              href={
                media.type === "movie"
                  ? `/movie/${encodeURIComponent(media.id)}`
                  : `/tv/${encodeURIComponent(media.id)}`
              }
              className="text-[11px] font-medium text-text-muted underline-offset-2 transition-colors hover:text-cream hover:underline"
            >
              Details
            </Link>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
