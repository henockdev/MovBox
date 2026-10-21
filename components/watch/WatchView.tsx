"use client";

import { useMemo, useState } from "react";
import { PageLoader } from "@/components/ui/PageLoader";
import { Player } from "@/components/player/Player";
import { WatchSession } from "./WatchSession";
import { MovieAutoplayOverlay } from "./MovieAutoplayOverlay";
import { useRouter } from "next/navigation";
import { useSources } from "@/lib/useSources";
import type { BoxSource, BoxCaption, MediaCard } from "@/lib/types";
import type { SeasonInfo } from "@/components/player/SeasonPicker";

interface WatchViewProps {
  /** "movie" or "tv" */
  type: "movie" | "tv";
  /** boxmovies detailPath (unique ID). */
  detailPath: string;
  /** TV only. */
  season?: number;
  /** TV only. */
  episode?: number;
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
  watchlistMedia?: Parameters<typeof WatchSession>[0]["watchlistMedia"];
}

/**
 * Watch page wrapper — fetches boxmovies sources, then renders the
 * WatchSession with the first source auto-selected. Shows a cinematic
 * PageLoader while we wait for the boxmovies-api puppeteer round-trip
 * to complete.
 */
export function WatchView(props: WatchViewProps) {
  const { type, detailPath, season, episode } = props;
  const router = useRouter();
  const [movieAutoplayOpen, setMovieAutoplayOpen] = useState(false);
  const { data, loading, error, refresh } = useSources({
    detailPath,
    season,
    episode,
  });

  const sources = useMemo<BoxSource[]>(() => data?.sources ?? [], [data]);
  const captions = useMemo<BoxCaption[]>(() => data?.captions ?? [], [data]);
  const isInitialLoad = loading && sources.length === 0;
  const isError = !!error && sources.length === 0;
  const isEmpty = !loading && !error && sources.length === 0;

  if (isInitialLoad || isError) {
    return (
      <div className="space-y-6">
        <div className="relative overflow-hidden rounded-xl border border-border">
          <PageLoader
            fullScreen={false}
            done={false}
            label={isError ? "NO SIGNAL" : "LOADING"}
            sublabel={
              isError
                ? (error ?? "Check your connection and try again")
                : "Grab your popcorn, the show is loading…"
            }
          />
        </div>
        {isError && (
          <div className="flex justify-center">
            <button
              type="button"
              onClick={refresh}
              className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-cream hover:bg-accent/80"
            >
              Try again
            </button>
          </div>
        )}
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_360px]">
          <div className="space-y-3">
            <div className="skeleton h-8 w-2/3 rounded-md" />
            <div className="skeleton h-4 w-1/3 rounded-md" />
            <div className="skeleton h-24 w-full rounded-md" />
          </div>
          <div className="space-y-2">
            <div className="skeleton h-10 w-full rounded-md" />
            <div className="skeleton h-10 w-full rounded-md" />
            <div className="skeleton h-10 w-full rounded-md" />
          </div>
        </div>
      </div>
    );
  }

  // When sources are still arriving (isInitialLoad=false because of stale
  // cache, but new fetch in flight) we render the player in its
  // "loading" state instead of the page-level skeleton. The player
  // will switch to playing the moment the fetch resolves.
  if (loading && sources.length === 0) {
    return (
      <div className="space-y-5 px-3 sm:px-0 md:space-y-8">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_360px] lg:gap-5">
          <div className="min-w-0">
            <Player
              sources={[]}
              captions={[]}
              activeSourceIndex={0}
              onSourceChange={() => {}}
              poster={props.backdropUrl ?? props.posterUrl}
              title={props.title}
              detailPath={props.detailPath}
              loading
            />
          </div>
          <div className="space-y-2">
            <div className="skeleton h-10 w-full rounded-md" />
            <div className="skeleton h-10 w-full rounded-md" />
          </div>
        </div>
      </div>
    );
  }

  if (isEmpty) {
    return (
      <div className="space-y-6">
        <div className="relative overflow-hidden rounded-xl border border-border">
          <PageLoader
            fullScreen={false}
            done
            label="NO STREAMS"
            sublabel="We couldn't find any working streams for this title right now."
          />
        </div>
        <div className="flex flex-col items-center gap-3 rounded-xl border border-border bg-surface/40 p-8 text-center">
          <p className="font-display text-lg text-cream">No streams available</p>
          <p className="max-w-md text-sm text-text-secondary">
            The source didn't return any playable streams. Try again in a few
            minutes.
          </p>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={refresh}
              className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-cream hover:bg-accent/80"
            >
              Search again
            </button>
            <button
              type="button"
              onClick={() => window.history.back()}
              className="rounded-md border border-border bg-surface-elevated px-4 py-2 text-sm font-medium text-cream hover:bg-surface-hover"
            >
              Go back
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <WatchSession
        {...props}
        sources={sources}
        captions={captions}
        loading={loading}
        onEnded={() => {
          // Movies get the related-movies autoplay. TV routes
          // own their own autoplay (see app/watch/tv/[id]/page.tsx)
          // because they have an explicit next-episode chain.
          if (props.type === "movie" && props.related.length > 0) {
            setMovieAutoplayOpen(true);
          }
        }}
      />
      {/* Movie autoplay overlay — only shows when:
            1. the user just finished a movie
            2. there are related movies to recommend
          TV pages own their own autoplay. */}
      {props.type === "movie" && movieAutoplayOpen && props.related.length > 0 ? (
        <MovieAutoplayOverlay
          topPick={props.related[0]}
          alsoRecommended={props.related.slice(1, 4)}
          onPlayNext={(m) => {
            setMovieAutoplayOpen(false);
            router.push(
              `/watch/${m.type === "tv" ? "tv" : "movie"}/${encodeURIComponent(m.id)}`,
            );
          }}
          onCancel={() => setMovieAutoplayOpen(false)}
        />
      ) : null}
    </>
  );
}
