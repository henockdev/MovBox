"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { WatchSession } from "@/components/watch/WatchSession";
import { AutoplayOverlay } from "@/components/watch/AutoplayOverlay";
import { useSources } from "@/lib/useSources";
import { useTVWatch } from "@/lib/watch-context";
import type { BoxSource, BoxCaption } from "@/lib/types";
import type { SeasonInfo } from "@/components/player/SeasonPicker";
import { cn } from "@/lib/utils";

/**
 * TV watch page — single stable React instance for the entire show.
 *
 *   /watch/tv/<id>     ← the page; reads ?s=1&e=1 from the URL
 *   /watch/tv/<id>/1/1 ← legacy URL; redirects to ?s=1&e=1 via the
 *                         [season]/[episode]/page.tsx below.
 *
 * Because the page is at a single segment (`/watch/tv/[id]`), Next.js
 * never unmounts it when the user clicks a different episode — it just
 * re-renders with the new search params. That means the player, the
 * SeasonPicker, the Similar row, and all the watch-session state stay
 * mounted. The only thing that re-runs is the sources fetch for the new
 * episode, and we show a tiny inline pill while that's in flight.
 *
 * This file is the CLIENT half of the route. The server half lives in
 * app/watch/tv/[id]/page.tsx — it exists so the route can emit
 * per-episode <title> / <link rel="canonical"> / JSON-LD in the served
 * HTML. Before that split, every episode of every show served the
 * identical site-wide default title.
 */
export default function WatchTVPageOuter() {
  return (
    <Suspense fallback={null}>
      <WatchTVPage />
    </Suspense>
  );
}

function WatchTVPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const { details, related, watchlistMedia } = useTVWatch();

  // Defaults: S1 E1. Clamp to known seasons/episodes.
  const season = clamp(parseInt(searchParams.get("s") ?? "1", 10), 1, 99);
  const episode = clamp(parseInt(searchParams.get("e") ?? "1", 10), 1, 9999);

  // If the user landed on the bare /watch/tv/<id> URL with no search
  // params, silently replace it with the canonical ?s=1&e=1 form so
  // deep links, the back button, and shareable URLs all carry the
  // episode info.
  useEffect(() => {
    if (!searchParams.get("s") || !searchParams.get("e")) {
      const params = new URLSearchParams(searchParams.toString());
      params.set("s", String(season));
      params.set("e", String(episode));
      router.replace(
        `/watch/tv/${encodeURIComponent(details.detailPath)}?${params.toString()}`,
        { scroll: false }
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep previous sources/captions mounted while the new ones load,
  // so the player never blanks out on episode change.
  const [prevSources, setPrevSources] = useState<BoxSource[]>([]);
  const [prevCaptions, setPrevCaptions] = useState<BoxCaption[]>([]);

  // Autoplay state. When the player's onEnded fires, we set
  // `autoplayOpen` with the next episode/season info. The
  // AutoplayOverlay runs a 5s countdown; on completion it calls
  // goToEpisode(season, episode).
  const [autoplay, setAutoplay] = useState<{
    nextSeason: number;
    nextEpisode: number;
    nextLabel: string;
  } | null>(null);

  const { data, loading } = useSources({
    detailPath: details.detailPath,
    season,
    episode,
  });

  const sources = useMemo(() => data?.sources ?? [], [data]);
  const captions = useMemo(() => data?.captions ?? [], [data]);

  useEffect(() => {
    if (sources.length > 0) {
      setPrevSources(sources);
      setPrevCaptions(captions);
    }
  }, [sources, captions]);

  const activeSources = sources.length > 0 ? sources : prevSources;
  const activeCaptions = sources.length > 0 ? captions : prevCaptions;
  const isSwitching = loading && activeSources.length > 0;

  // Resolve episode nav.
  const currentSeason = details.seasons.find((s) => s.season === season);
  const episodes = currentSeason?.episodes ?? [];
  const currentEpisodeIdx = episodes.indexOf(episode);
  const prevEp =
    currentEpisodeIdx > 0 ? episodes[currentEpisodeIdx - 1] : null;
  const nextEp =
    currentEpisodeIdx >= 0 && currentEpisodeIdx < episodes.length - 1
      ? episodes[currentEpisodeIdx + 1]
      : null;
  const nextSeason = details.seasons.find((s) => s.season === season + 1);

  const year = details.releaseYear?.toString() ?? "";

  function goToEpisode(s: number, e: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("s", String(s));
    params.set("e", String(e));
    router.replace(`/watch/tv/${encodeURIComponent(details.detailPath)}?${params.toString()}`, { scroll: false });
  }

  return (
    <div className="bg-bg-deepest">
      <header className="sticky top-0 z-30 flex items-center gap-2 border-b border-border bg-bg-deepest/90 px-3 py-2.5 backdrop-blur sm:px-5 sm:py-3 md:px-6">
        <Button asChild variant="ghost" size="icon" aria-label="Back">
          <Link href={`/tv/${encodeURIComponent(details.detailPath)}`}>
            <ArrowLeft className="h-4 w-4 sm:h-5 sm:w-5" />
          </Link>
        </Button>
        <div className="min-w-0 flex-1">
          <h1 className="line-clamp-1 font-display text-sm font-semibold text-cream sm:text-base md:text-lg">
            {details.title}
          </h1>
          <p className="text-[11px] text-text-muted sm:text-xs">
            S{season} · E{episode}
          </p>
        </div>
        <div className="flex items-center gap-1">
          {prevEp != null ? (
            <Button
              variant="ghost"
              size="icon"
              aria-label="Previous episode"
              onClick={() => goToEpisode(season, prevEp)}
            >
              <ChevronLeft className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            </Button>
          ) : null}
          {nextEp != null ? (
            <Button
              variant="ghost"
              size="icon"
              aria-label="Next episode"
              onClick={() => goToEpisode(season, nextEp)}
            >
              <ChevronRight className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            </Button>
          ) : nextSeason ? (
            <Button
              variant="ghost"
              size="icon"
              aria-label="Next season"
              onClick={() => goToEpisode(nextSeason.season, 1)}
            >
              <ChevronRight className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            </Button>
          ) : null}
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-0 pb-12 pt-0 sm:px-3 sm:pt-3 md:px-6 md:pt-6">
        {/* Page is ALWAYS rendered with the player area visible. No full
            PageLoader flash on episode change — only a small inline pill. */}
        <WatchSession
          type="tv"
          detailPath={details.detailPath}
          sources={activeSources}
          captions={activeCaptions}
          title={details.title}
          year={year}
          runtime={null}
          voteAverage={details.rating ?? 0}
          posterUrl={details.posterUrl}
          backdropUrl={details.backdropUrl}
          overview={details.synopsis}
          genres={(details.genres ?? []).map((g, i) => ({ id: i, name: g }))}
          country={details.country ?? null}
          releaseDate={details.releaseDate || ""}
          availableSubtitles={details.availableSubtitleLanguages}
          seasonNumber={season}
          episodeNumber={episode}
          seasons={details.seasons as SeasonInfo[]}
          related={related}
          watchlistMedia={watchlistMedia}
          onEnded={() => {
            // Resolve the next episode and open the autoplay overlay.
            // If there's a next episode in the current season, use it.
            // Otherwise jump to the first episode of the next season.
            // If neither, don't open the overlay (end of series).
            if (nextEp != null) {
              setAutoplay({
                nextSeason: season,
                nextEpisode: nextEp,
                nextLabel: `S${season} · E${nextEp}`,
              });
            } else if (nextSeason) {
              setAutoplay({
                nextSeason: nextSeason.season,
                nextEpisode: 1,
                nextLabel: `S${nextSeason.season} · E1`,
              });
            }
          }}
        />

        {/* Autoplay countdown — appears on top of the player when
            the current episode ends. User can cancel or hit "Play
            now" to skip the countdown. */}
        {autoplay ? (
          <AutoplayOverlay
            nextTitle={details.title}
            nextLabel={autoplay.nextLabel}
            nextBackdrop={details.backdropUrl ?? details.posterUrl}
            season={autoplay.nextSeason}
            episode={autoplay.nextEpisode}
            onPlayNext={() => {
              const target = autoplay;
              setAutoplay(null);
              goToEpisode(target.nextSeason, target.nextEpisode);
            }}
            onCancel={() => setAutoplay(null)}
          />
        ) : null}

        {/* Initial-load pill (only when we have NO sources at all yet). */}
        {activeSources.length === 0 && (
          <div className="pointer-events-none fixed left-1/2 top-20 z-40 -translate-x-1/2 rounded-full border border-border bg-bg-deepest/85 px-3 py-1.5 text-xs text-cream shadow-elevated backdrop-blur">
            <span className="inline-flex items-center gap-2">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-accent-bright" />
              Loading…
            </span>
          </div>
        )}

        {/* Tiny inline pill during episode switch (sources are still
            playing, just a soft indicator). */}
        {isSwitching && (
          <div
            className={cn(
              "pointer-events-none fixed left-1/2 top-20 z-40 -translate-x-1/2 rounded-full border border-border bg-bg-deepest/85 px-3 py-1.5 text-xs text-cream shadow-elevated backdrop-blur transition-opacity",
              activeSources.length > 0 ? "opacity-100" : "opacity-0"
            )}
          >
            <span className="inline-flex items-center gap-2">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-accent-bright" />
              Loading S{season} · E{episode}…
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

function clamp(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, n));
}

// Type-only re-exports so the local `useState` defaults above type-check.
type sourcesType = Parameters<typeof WatchSession>[0]["sources"];
type captionsType = Parameters<typeof WatchSession>[0]["captions"];
