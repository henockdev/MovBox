"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import Image from "next/image";
import { Play, Star, Volume2, VolumeX, X } from "lucide-react";
import { formatRating, formatYear } from "@/lib/format";
import type { PreviewMedia } from "@/components/media/HoverPreview";

/**
 * The trailer sheet — the mobile half of the card preview.
 *
 * A phone has no hover, so the desktop popup has no trigger there. The
 * card grows a small trailer button instead (visible only on coarse
 * pointers), and tapping it slides this sheet up from the bottom edge:
 * the trailer playing, the title, its meta, and the two ways onward —
 * Play (the watch page) and Details (the title's page).
 *
 * ## Why a sheet and not a full-screen overlay
 *
 * A sheet keeps the grid visible behind it, so the visitor can dismiss it
 * and carry on browsing. It is also the pattern every streaming app uses
 * for a quick preview, and it leaves the thumb zone free.
 *
 * ## The poster still navigates
 *
 * Tapping the poster goes to the title's page, exactly as before. Only the
 * trailer button opens the sheet, so the preview never gets in the way of
 * browsing.
 */

/** How far the sheet has to be dragged down before it dismisses. */
const DISMISS_DRAG_PX = 90;

interface TrailerSheetProps {
  media: PreviewMedia | null;
  open: boolean;
  onClose: () => void;
}

export function TrailerSheet({ media, open, onClose }: TrailerSheetProps) {
  const [mounted, setMounted] = useState(false);
  const [muted, setMuted] = useState(true);
  const [dragY, setDragY] = useState(0);
  const dragStart = useRef<number | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => setMounted(true), []);

  // ---- the video ------------------------------------------------------------
  useEffect(() => {
    if (!open) {
      setMuted(true);
      setDragY(0);
      dragStart.current = null;
      return;
    }
    const v = videoRef.current;
    if (!v) return;
    v.muted = muted;
    const play = v.play();
    if (play && typeof play.catch === "function") play.catch(() => {});
  }, [open, muted, media?.id]);

  // ---- scroll lock ----------------------------------------------------------
  useEffect(() => {
    if (!open) return;
    const { body } = document;
    const prev = body.style.overflow;
    body.style.overflow = "hidden";
    return () => {
      body.style.overflow = prev;
    };
  }, [open]);

  // ---- Escape ---------------------------------------------------------------
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    dragStart.current = e.touches[0]?.clientY ?? null;
  }, []);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (dragStart.current === null) return;
    const y = e.touches[0]?.clientY ?? dragStart.current;
    setDragY(Math.max(0, y - dragStart.current));
  }, []);

  const onTouchEnd = useCallback(() => {
    if (dragStart.current === null) return;
    if (dragY > DISMISS_DRAG_PX) {
      onClose();
    }
    dragStart.current = null;
    setDragY(0);
  }, [dragY, onClose]);

  if (!mounted || !open || !media) return null;

  const watchHref =
    media.type === "movie"
      ? `/watch/movie/${encodeURIComponent(media.id)}`
      : `/tv/${encodeURIComponent(media.id)}`;
  const detailHref =
    media.type === "movie"
      ? `/movie/${encodeURIComponent(media.id)}`
      : `/tv/${encodeURIComponent(media.id)}`;

  const meta = [
    formatYear(media.year) || null,
    media.country || null,
    media.genres?.length ? media.genres.slice(0, 3).join(", ") : null,
  ].filter(Boolean) as string[];

  return createPortal(
    <div className="fixed inset-0 z-[90]" role="dialog" aria-modal="true">
      {/* Backdrop */}
      <div
        className="backdrop-in absolute inset-0 bg-bg-deepest/85 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* The sheet */}
      <div
        className="sheet-up absolute inset-x-0 bottom-0 flex max-h-[92dvh] flex-col overflow-hidden rounded-t-2xl border-t border-border-strong bg-bg-deepest shadow-[0_-20px_60px_rgba(0,0,0,0.6)]"
        style={{
          transform: dragY ? `translateY(${dragY}px)` : undefined,
          transition: dragY ? "none" : "transform 220ms cubic-bezier(0.22,1,0.36,1)",
        }}
      >
        {/* Drag handle */}
        <div
          className="flex shrink-0 cursor-grab touch-none justify-center pt-2.5 pb-1"
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
          aria-hidden="true"
        >
          <span className="h-1 w-10 rounded-full bg-border-strong" />
        </div>

        {/* Close */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close the trailer"
          className="absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-cream/90 backdrop-blur-sm transition-colors hover:bg-black/80"
        >
          <X className="h-4 w-4" />
        </button>

        {/* ---- the trailer ---- */}
        <div className="relative aspect-video w-full shrink-0 overflow-hidden bg-black">
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
              className="h-full w-full object-cover"
            />
          ) : (
            (media.backdropPath || media.posterPath) && (
              <Image
                src={media.backdropPath || media.posterPath}
                alt=""
                fill
                sizes="100vw"
                className="h-full w-full object-cover"
              />
            )
          )}
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "radial-gradient(ellipse at 50% 50%, transparent 45%, rgba(8,6,6,0.55) 100%)",
            }}
          />
          <button
            type="button"
            onClick={() => setMuted((m) => !m)}
            aria-label={muted ? "Unmute trailer" : "Mute trailer"}
            className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-cream/90 backdrop-blur-sm transition-colors hover:bg-black/80"
          >
            {muted ? (
              <VolumeX className="h-4 w-4" />
            ) : (
              <Volume2 className="h-4 w-4" />
            )}
          </button>
        </div>

        {/* ---- the info ---- */}
        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-[calc(env(safe-area-inset-bottom)+1.25rem)] pt-3">
          <h3 className="font-display text-lg font-bold leading-tight text-cream">
            {media.title}
          </h3>
          {media.rating > 0 && (
            <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-text-secondary">
              <span className="inline-flex items-center gap-1 font-semibold text-yellow-400">
                <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />
                {formatRating(media.rating)}
              </span>
              {meta.map((m) => (
                <span key={m} className="text-text-muted">
                  · {m}
                </span>
              ))}
            </p>
          )}

          {media.overview && (
            <p className="mt-2 line-clamp-3 text-xs leading-relaxed text-text-secondary">
              {media.overview}
            </p>
          )}

          <div className="mt-4 flex items-center gap-2.5">
            <Link
              href={watchHref}
              onClick={onClose}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-brand px-4 py-3 text-sm font-semibold text-cream shadow-glow transition-colors hover:bg-accent"
            >
              <Play className="h-4 w-4 fill-current" />
              Play
            </Link>
            <Link
              href={detailHref}
              onClick={onClose}
              className="inline-flex items-center justify-center rounded-full border border-border px-4 py-3 text-sm font-medium text-cream transition-colors hover:bg-surface-hover"
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
