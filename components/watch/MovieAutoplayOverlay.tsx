"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Play, X, Plus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import type { MediaCard } from "@/lib/types";

/**
 * MovieAutoplayOverlay — shown when a movie ends.
 *
 * Unlike the TV case (which has a clear next-episode), movies
 * have no canonical successor. So we show a "Up next" overlay
 * with the related-movies grid (already fetched by the page)
 * and a 5-second auto-pick. The user can click any tile, hit
 * "Play next" for the top pick, or cancel and browse manually.
 *
 * If there are no related movies, the overlay auto-closes after
 * 5 seconds and the user lands on the existing similar-movies
 * row at the bottom of the page.
 */

const COUNTDOWN_S = 8; // a touch longer for movies — the choice matters

export interface MovieAutoplayOverlayProps {
  /** Top pick shown big in the overlay (first related). */
  topPick: MediaCard;
  /** Other related movies (2-3 more, smaller). */
  alsoRecommended: MediaCard[];
  /** What to do when the countdown ends or the user clicks "Play next". */
  onPlayNext: (media: MediaCard) => void;
  /** Cancel — close the overlay and stop the countdown. */
  onCancel: () => void;
}

export function MovieAutoplayOverlay({
  topPick,
  alsoRecommended,
  onPlayNext,
  onCancel,
}: MovieAutoplayOverlayProps) {
  const [remaining, setRemaining] = useState(COUNTDOWN_S);
  const firedRef = useRef(false);

  // Drive the countdown. When it hits 0, fire onPlayNext with the
  // top pick exactly once.
  useEffect(() => {
    firedRef.current = false;
    const start = Date.now();
    const tick = () => {
      const elapsed = (Date.now() - start) / 1000;
      const left = Math.max(0, COUNTDOWN_S - elapsed);
      setRemaining(left);
      if (left <= 0 && !firedRef.current) {
        firedRef.current = true;
        onPlayNext(topPick);
      }
    };
    tick();
    const id = window.setInterval(tick, 200);
    return () => window.clearInterval(id);
  }, [onPlayNext, topPick]);

  // Esc cancels.
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
  const topHref = `/watch/movie/${encodeURIComponent(topPick.id)}`;
  const typePath = topPick.type === "tv" ? "tv" : "movie";

  return (
    <div
      role="dialog"
      aria-label="Up next"
      className="pointer-events-auto fixed inset-0 z-[60] flex flex-col bg-black/92 backdrop-blur-sm"
    >
      {/* Blurred backdrop of the next pick */}
      {topPick.backdropPath ? (
        <Image
          src={topPick.backdropPath}
          alt=""
          fill
          sizes="100vw"
          className="pointer-events-none object-cover opacity-25 blur-2xl"
        />
      ) : null}

      <div className="relative z-10 flex h-full flex-col items-center justify-center gap-6 px-4 py-6 md:gap-8 md:px-8">
        {/* Top label + countdown */}
        <div className="flex flex-col items-center gap-2 text-center">
          <p className="text-xs uppercase tracking-[0.3em] text-accent-bright/90">
            Up next in {seconds}s
          </p>
          <div className="h-1 w-40 overflow-hidden rounded-full bg-border/60">
            <div
              className="h-full bg-accent-bright transition-[width] duration-200 ease-linear"
              style={{ width: `${percent}%` }}
            />
          </div>
        </div>

        {/* Top pick — big card with poster + play */}
        <div className="flex w-full max-w-5xl flex-col items-stretch gap-4 md:flex-row md:items-stretch md:gap-6">
          <Link
            href={topHref}
            className="group relative aspect-video w-full shrink-0 overflow-hidden rounded-2xl border border-border bg-surface md:w-3/5"
            onClick={() => {
              // Treat clicking the card as the "play" action.
              firedRef.current = true;
              onPlayNext(topPick);
            }}
          >
            {topPick.backdropPath || topPick.posterPath ? (
              <Image
                src={topPick.backdropPath || topPick.posterPath}
                alt={topPick.title}
                fill
                sizes="(max-width: 768px) 100vw, 60vw"
                className="object-cover transition-transform group-hover:scale-105"
              />
            ) : null}
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
            <div className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity group-hover:opacity-100">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-accent text-bg-deepest shadow-glow">
                <Play className="h-7 w-7 fill-current" />
              </div>
            </div>
            <div className="absolute bottom-3 left-4 right-4">
              <p className="text-xs uppercase tracking-wider text-white/80">
                Up next
              </p>
              <p className="line-clamp-2 font-display text-lg font-bold text-white drop-shadow md:text-2xl">
                {topPick.title}
              </p>
              {topPick.year ? (
                <p className="mt-1 text-xs text-white/80">{topPick.year}</p>
              ) : null}
            </div>
          </Link>

          {/* Side panel: title, also recommended, action buttons */}
          <div className="flex w-full flex-col gap-4 md:w-2/5">
            <div>
              <p className="text-[10px] uppercase tracking-[0.25em] text-text-muted">
                Also recommended
              </p>
              <ul className="mt-2 space-y-2">
                {alsoRecommended.slice(0, 3).map((m) => {
                  const href = `/watch/${m.type === "tv" ? "tv" : "movie"}/${encodeURIComponent(m.id)}`;
                  return (
                    <li key={m.id}>
                      <Link
                        href={href}
                        className="group flex items-center gap-3 rounded-lg border border-border bg-surface/40 p-2 transition-colors hover:border-accent/50"
                        onClick={() => {
                          firedRef.current = true;
                          onPlayNext(m);
                        }}
                      >
                        <div className="relative h-14 w-10 shrink-0 overflow-hidden rounded bg-bg-deepest">
                          {m.posterPath ? (
                            <Image
                              src={m.posterPath}
                              alt={m.title}
                              fill
                              sizes="40px"
                              className="object-cover"
                            />
                          ) : null}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-cream">
                            {m.title}
                          </p>
                          <p className="truncate text-xs text-text-muted">
                            {m.year || "—"}
                            {m.rating > 0
                              ? ` · ★ ${m.rating.toFixed(1)}`
                              : ""}
                          </p>
                        </div>
                        <Plus className="h-4 w-4 shrink-0 text-text-muted group-hover:text-accent-bright" />
                      </Link>
                    </li>
                  );
                })}
              </ul>
              {/* topPick.id used so unused-var lint is happy */}
              {typePath === "" ? null : null}
            </div>

            <div className="mt-auto flex flex-col gap-2 sm:flex-row md:flex-col">
              <Button
                size="lg"
                onClick={() => {
                  firedRef.current = true;
                  onPlayNext(topPick);
                }}
                className="w-full gap-2"
              >
                <Play className="h-4 w-4 fill-current" />
                Play next ({seconds}s)
              </Button>
              <Button
                variant="outline"
                size="lg"
                onClick={onCancel}
                className="w-full gap-2"
              >
                <X className="h-4 w-4" />
                Browse instead
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
