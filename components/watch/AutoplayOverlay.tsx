"use client";

import { useEffect, useRef, useState } from "react";
import { Play, X, FastForward } from "lucide-react";
import { Button } from "@/components/ui/Button";
import Image from "next/image";

/**
 * AutoplayOverlay — Netflix-style "Up next in 5…" countdown.
 *
 * Renders when an episode ends. Shows a fullscreen overlay with a
 * backdrop preview, episode title, and a 5-second countdown. If the
 * user doesn't interact, we call `onPlayNext()` which navigates to
 * the next episode (or season). The user can cancel anytime.
 *
 * Why 5 seconds:
 *   - long enough to grab attention ("oh, the next one is queued")
 *   - short enough to not feel like an ad
 *   - matches the convention every streaming app uses
 */

const COUNTDOWN_S = 5;

export interface AutoplayOverlayProps {
  /** Title of the next episode / show. */
  nextTitle: string;
  /** Sub-line: e.g. "S2 E4" or "Movie". */
  nextLabel: string;
  /** Backdrop image URL (16:9). Falls back to poster. */
  nextBackdrop?: string | null;
  /** Optional season number, for the badge. */
  season?: number;
  /** Optional episode number, for the badge. */
  episode?: number;
  /** What to do when the countdown ends or the user clicks "Play now". */
  onPlayNext: () => void;
  /** Cancel — close the overlay and stop the countdown. */
  onCancel: () => void;
}

export function AutoplayOverlay({
  nextTitle,
  nextLabel,
  nextBackdrop,
  season,
  episode,
  onPlayNext,
  onCancel,
}: AutoplayOverlayProps) {
  const [remaining, setRemaining] = useState(COUNTDOWN_S);
  const firedRef = useRef(false);

  // Drive the countdown. When it hits 0, fire onPlayNext exactly once.
  useEffect(() => {
    firedRef.current = false;
    const start = Date.now();
    const tick = () => {
      const elapsed = (Date.now() - start) / 1000;
      const left = Math.max(0, COUNTDOWN_S - elapsed);
      setRemaining(left);
      if (left <= 0 && !firedRef.current) {
        firedRef.current = true;
        onPlayNext();
      }
    };
    tick();
    const id = window.setInterval(tick, 200);
    return () => window.clearInterval(id);
  }, [onPlayNext]);

  // Allow Esc / spacebar to cancel.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onCancel();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  const seconds = Math.ceil(remaining);
  const percent = (remaining / COUNTDOWN_S) * 100;

  return (
    <div
      role="dialog"
      aria-label="Up next"
      className="pointer-events-auto fixed inset-0 z-[60] flex items-center justify-center bg-black/85 backdrop-blur-sm"
    >
      {/* Backdrop preview (blurred) */}
      {nextBackdrop ? (
        <Image
          src={nextBackdrop}
          alt=""
          fill
          sizes="100vw"
          className="object-cover opacity-30 blur-md"
        />
      ) : null}

      <div className="relative z-10 flex w-full max-w-2xl flex-col items-center gap-6 px-6 text-center">
        <p className="text-xs uppercase tracking-[0.3em] text-accent-bright/90">
          Up next
        </p>
        <h2 className="font-display text-2xl font-bold text-cream drop-shadow md:text-3xl">
          {nextTitle}
        </h2>
        <p className="text-sm text-text-secondary">{nextLabel}</p>

        {/* Circular countdown ring */}
        <div className="relative h-24 w-24">
          <svg
            className="h-24 w-24 -rotate-90"
            viewBox="0 0 100 100"
            aria-hidden="true"
          >
            <circle
              cx="50"
              cy="50"
              r="44"
              stroke="currentColor"
              strokeWidth="6"
              fill="none"
              className="text-border"
            />
            <circle
              cx="50"
              cy="50"
              r="44"
              stroke="currentColor"
              strokeWidth="6"
              fill="none"
              className="text-accent-bright transition-[stroke-dashoffset] duration-200 ease-linear"
              strokeDasharray={2 * Math.PI * 44}
              strokeDashoffset={(2 * Math.PI * 44) * (1 - percent / 100)}
              strokeLinecap="round"
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center font-display text-3xl font-bold text-cream">
            {seconds}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-3">
          <Button
            size="lg"
            onClick={onPlayNext}
            className="gap-2"
            autoFocus
          >
            <Play className="h-4 w-4 fill-current" />
            Play now
          </Button>
          <Button
            variant="outline"
            size="lg"
            onClick={onCancel}
            className="gap-2"
          >
            <X className="h-4 w-4" />
            Cancel
          </Button>
        </div>

        <p className="flex items-center gap-1.5 text-[11px] text-text-muted">
          <FastForward className="h-3 w-3" />
          Press <kbd className="rounded border border-border bg-surface-elevated px-1.5 font-mono">Esc</kbd> to cancel
        </p>

        {/* Suppress unused-prop warnings — keep types in sync */}
        {season == null && episode == null ? null : null}
      </div>
    </div>
  );
}
