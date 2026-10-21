"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Badge } from "@/components/ui/Badge";
import { MovieCard } from "@/components/home/MovieCard";
import { Player } from "@/components/player/Player";
import { SourceList } from "@/components/player/SourceList";
import { WatchlistButton } from "@/components/watchlist/WatchlistButton";
import {
  Heart,
  Plus,
  Share2,
  Star,
  ThumbsDown,
  ThumbsUp,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { formatRating, formatRuntime, formatYear } from "@/lib/format";
import type {
  BoxSource,
  BoxCaption,
  MediaCard,
} from "@/lib/types";
import { cn } from "@/lib/utils";
import type { SeasonInfo } from "@/components/player/SeasonPicker";

interface WatchSessionProps {
  type: "movie" | "tv";
  /** boxmovies detailPath. */
  detailPath: string;
  /** All available sources from boxmovies (one or more MP4 qualities). */
  sources: BoxSource[];
  /** Title-level captions list. */
  captions?: BoxCaption[];
  title: string;
  year: string;
  runtime?: number | null;
  voteAverage: number;
  posterUrl: string | null;
  backdropUrl: string | null;
  overview: string;
  genres?: { id: number; name: string }[];
  country?: string | null;
  releaseDate?: string;
  availableSubtitles?: string[];
  episodeNumber?: number;
  seasonNumber?: number;
  related: MediaCard[];
  /** TV only — drives the Seasons & Episodes picker. */
  seasons?: SeasonInfo[];
  watchlistMedia?: Parameters<typeof WatchlistButton>[0]["media"];
  onEnded?: () => void;
  /**
   * True while the parent (WatchView) is still fetching sources. Passed
   * down to the player so it can show a clean loading skeleton instead
   * of flashing the "No sources" empty-state before data arrives.
   */
  loading?: boolean;
}

/**
 * Watch session layout:
 *
 *  ┌─────────────────────────────────┬──────────────────┐
 *  │           Player               │  SourceList       │
 *  │  (title overlay + controls)    │  (Playlist/Related)│
 *  ├─────────────────────────────────┼──────────────────┤
 *  │  poster  title  ratings actions │  meta table       │
 *  │         overview               │  You Might Also   │
 *  │                                │  Like (cards)     │
 *  └─────────────────────────────────┴──────────────────┘
 */
export function WatchSession(props: WatchSessionProps) {
  const {
    type,
    detailPath,
    loading = false,
    sources,
    captions,
    title,
    year,
    runtime,
    voteAverage,
    posterUrl,
    backdropUrl,
    overview,
    genres = [],
    country,
    releaseDate,
    availableSubtitles,
    episodeNumber,
    seasonNumber,
    related,
    seasons = [],
    watchlistMedia,
  } = props;

  const [activeSourceIndex, setActiveSourceIndex] = useState(0);
  const [userRating, setUserRating] = useState<"up" | "down" | null>(null);

  // Auto-select the SMALLEST quality once the ladder arrives.
  //
  // The relay returns the ladder smallest-first, so index 0 already is the
  // lowest rung — but we don't want the default to silently depend on
  // array order, so we resolve the lowest resolution explicitly.
  //
  // The ref holds the URL set the selection was made for: a brand new
  // episode (different URLs) re-runs the selection, but a quality change
  // the user made themselves (same URLs) is never overridden.
  const autoSelectKeyRef = useRef<string>("");
  useEffect(() => {
    if (!sources.length) return;
    const key = sources.map((s) => s.url).join("|");
    if (!key || key === autoSelectKeyRef.current) return;
    autoSelectKeyRef.current = key;

    let smallest = 0;
    let bestRes = Number.POSITIVE_INFINITY;
    sources.forEach((s, i) => {
      const res =
        Number(s.resolution) || Number(s.quality?.replace(/[^\d]/g, "")) || 0;
      if (res > 0 && res < bestRes) {
        bestRes = res;
        smallest = i;
      }
    });
    setActiveSourceIndex(smallest);
  }, [sources]);

  const metaLine = [
    year,
    runtime ? formatRuntime(runtime) : null,
    country,
  ]
    .filter(Boolean)
    .join("   ");

  return (
    <div className="space-y-5 px-3 sm:px-0 md:space-y-8">
      {/* Top row — Player + SourceList sidebar */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_360px] lg:gap-5">
        <div className="min-w-0">
          <Player
            sources={sources}
            captions={captions ?? []}
            activeSourceIndex={activeSourceIndex}
            onSourceChange={setActiveSourceIndex}
            poster={backdropUrl ?? posterUrl}
            backdrop={backdropUrl ?? null}
            title={title}
            detailPath={detailPath}
            type={type}
            season={seasonNumber}
            episode={episodeNumber}
            loading={loading}
            metaLine={
              type === "tv" && seasonNumber != null && episodeNumber != null
                ? `S${seasonNumber} · E${episodeNumber} · ${title}`
                : metaLine
            }
            onRate={(r) => {
              setUserRating(r);
            }}
            onAddToList={() => {
              /* hook up to list toast */
            }}
          />
        </div>
        <div className="lg:min-h-0">
          <SourceList
            sources={sources}
            activeSourceIndex={activeSourceIndex}
            onSelect={setActiveSourceIndex}
            thumbnail={backdropUrl ?? posterUrl}
            mediaType={type}
            related={related}
            heading={title}
            seasons={seasons}
            currentSeason={seasonNumber ?? 1}
            currentEpisode={episodeNumber ?? 1}
            posterUrl={posterUrl}
            detailPath={detailPath}
          />
        </div>
      </div>

      {/* Bottom row — details (left) + meta + related (right) */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_360px] lg:gap-8">
        {/* Left: poster + title + meta + actions + plot */}
        <section className="min-w-0">
          <div className="grid grid-cols-[100px_1fr] gap-3 sm:grid-cols-[140px_1fr] sm:gap-4 md:grid-cols-[160px_1fr] md:gap-5">
            <div className="relative aspect-[2/3] overflow-hidden rounded-xl border border-border bg-surface shadow-card">
              {posterUrl ? (
                <img
                  src={posterUrl}
                  alt={title}
                  className="absolute inset-0 h-full w-full object-cover"
                  loading="lazy"
                />
              ) : (
                <div
                  className="flex h-full w-full items-center justify-center"
                  style={{ background: "#53151e" }}
                >
                  <span className="font-display text-sm text-cream/40">
                    Movbox
                  </span>
                </div>
              )}
            </div>

            <div>
              <h2 className="font-display text-lg font-bold text-cream sm:text-xl md:text-2xl lg:text-3xl">
                {title}
              </h2>
              {type === "tv" && seasonNumber != null && episodeNumber != null && (
                <p className="mt-1 text-sm text-text-secondary md:text-base">
                  S{seasonNumber} · E{episodeNumber}
                </p>
              )}

              <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
                {voteAverage > 0 && (
                  <span className="inline-flex items-center gap-1 rounded-md bg-yellow-400/15 px-2 py-1 font-semibold text-yellow-400">
                    <Star className="h-3.5 w-3.5 fill-current" />
                    {formatRating(voteAverage)}<span className="text-yellow-400/60">/10</span>
                  </span>
                )}
                {voteAverage > 0 && (
                  <span className="inline-flex items-center gap-1 rounded-md bg-red-500/15 px-2 py-1 text-red-400">
                    <Heart className="h-3.5 w-3.5 fill-current" />
                    {Math.round(voteAverage * 10)}%
                  </span>
                )}
                <span className="text-text-muted">
                  {releaseDate ? formatYear(releaseDate) : year}
                </span>
                {runtime ? (
                  <span className="text-text-muted">{formatRuntime(runtime)}</span>
                ) : null}
                {country ? (
                  <span className="text-text-muted">{country}</span>
                ) : null}
              </div>

              {genres.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {genres.map((g) => (
                    <Badge key={g.id} variant="default">
                      {g.name}
                    </Badge>
                  ))}
                </div>
              )}

              {availableSubtitles && availableSubtitles.length > 0 && (
                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-text-muted">
                  <span className="uppercase tracking-wider">Subtitles:</span>
                  {availableSubtitles.slice(0, 8).map((s) => (
                    <span
                      key={s}
                      className="rounded-md border border-border bg-surface-elevated/60 px-2 py-0.5"
                    >
                      {s}
                    </span>
                  ))}
                  {availableSubtitles.length > 8 && (
                    <span className="text-text-muted">
                      +{availableSubtitles.length - 8} more
                    </span>
                  )}
                </div>
              )}

              <p className="mt-4 max-w-3xl text-sm leading-relaxed text-text-primary md:text-base">
                {overview || "No synopsis available."}
              </p>

              <div className="mt-5 flex flex-wrap items-center gap-2">
                {watchlistMedia && (
                  <WatchlistButton media={watchlistMedia} size="md" />
                )}
                {!watchlistMedia && (
                  <Button variant="primary" size="md">
                    <Plus className="h-4 w-4" />
                    My List
                  </Button>
                )}
                <button
                  type="button"
                  onClick={() =>
                    setUserRating((r) => (r === "up" ? null : "up"))
                  }
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-md border border-border bg-surface-elevated px-3 py-1.5 text-sm font-medium text-text-primary transition-colors hover:border-accent hover:text-accent-bright",
                    userRating === "up" && "border-accent text-accent-bright"
                  )}
                  aria-label="Like"
                >
                  <ThumbsUp className="h-4 w-4" />
                  Like
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setUserRating((r) => (r === "down" ? null : "down"))
                  }
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-md border border-border bg-surface-elevated px-3 py-1.5 text-sm font-medium text-text-primary transition-colors hover:border-accent hover:text-accent-bright",
                    userRating === "down" && "border-accent text-accent-bright"
                  )}
                  aria-label="Dislike"
                >
                  <ThumbsDown className="h-4 w-4" />
                  Dislike
                </button>
                <button
                  type="button"
                  className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface-elevated px-3 py-1.5 text-sm font-medium text-text-primary transition-colors hover:border-accent hover:text-accent-bright"
                  aria-label="Share"
                >
                  <Share2 className="h-4 w-4" />
                  Share
                </button>
              </div>
            </div>
          </div>
        </section>

        <aside className="space-y-6">
          <div className="space-y-2.5 rounded-lg border border-border bg-surface/40 p-4 text-sm">
            {country && <MetaRow label="Country" value={country} />}
            {genres.length > 0 && (
              <MetaRow
                label="Genres"
                value={genres.map((g) => g.name).join(", ")}
              />
            )}
            {releaseDate && <MetaRow label="Release Date" value={releaseDate} />}
            {availableSubtitles && availableSubtitles.length > 0 && (
              <MetaRow
                label="Subtitles"
                value={`${availableSubtitles.length} languages`}
              />
            )}
            <MetaRow label="Source" value="BoxMovies" />
          </div>
        </aside>
      </div>

      {/* Similar row at the bottom — wider than the sidebar version, scrolls. */}
      {related.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-end justify-between border-b border-border/60 pb-3">
            <div>
              <h3 className="font-display text-xl font-semibold text-cream">
                {type === "tv" ? "Similar Shows" : "Similar Movies"}
              </h3>
              <p className="mt-0.5 text-xs text-text-muted">
                Hand-picked from boxmovies · {related.length} titles
              </p>
            </div>
          </div>
          <div className="-mx-1 flex snap-x snap-mandatory gap-3 overflow-x-auto px-1 pb-2">
            {related.map((m) => (
              <div
                key={`${m.type}-${m.id}`}
                className="w-40 shrink-0 snap-start sm:w-44"
              >
                <MovieCard media={m} className="w-full" />
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[88px_1fr] items-start gap-3">
      <span className="text-xs uppercase tracking-wider text-text-muted">
        {label}
      </span>
      <span className="text-sm text-text-primary">{value}</span>
    </div>
  );
}
