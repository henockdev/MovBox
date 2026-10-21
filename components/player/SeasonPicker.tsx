"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight, Film, Play, Tv } from "lucide-react";
import { cn } from "@/lib/utils";
import { imageUrl } from "@/lib/image";

export interface SeasonInfo {
  season: number;
  episodeCount: number;
  /** Episode numbers actually present in boxmovies (when known). */
  episodes?: number[] | null;
}

interface SeasonPickerProps {
  detailPath: string;
  seasons: SeasonInfo[];
  currentSeason: number;
  currentEpisode: number;
  posterUrl?: string | null;
  backdropUrl?: string | null;
  className?: string;
}

/**
 * Right-sidebar picker for TV shows. Renders an accordion of seasons;
 * each season expands to show its episodes. Clicking an episode navigates
 * to `/watch/tv/{detailPath}/{season}/{episode}` which the player page
 * handles with a server-side redirect/render.
 *
 * Behavior:
 * - Auto-expands the season containing the current episode.
 * - Falls back to "Season 1 · Episode 1" when no season data is available.
 * - Caps visible episodes per season at 24 to keep the panel lightweight;
 *   we add a hint when more are available.
 */
export function SeasonPicker({
  detailPath,
  seasons,
  currentSeason,
  currentEpisode,
  posterUrl,
  backdropUrl,
  className,
}: SeasonPickerProps) {
  const router = useRouter();
  // If boxmovies gave us no season data, synthesize a single Season 1,
  // Episode 1 so the picker is still useful (the player URL lets the
  // user manually navigate to S2E1 etc.).
  const list: SeasonInfo[] =
    seasons.length > 0
      ? [...seasons].sort((a, b) => a.season - b.season)
      : [{ season: 1, episodeCount: 1, episodes: [1] }];

  // Auto-expand the active season on first render.
  const [openSeason, setOpenSeason] = useState<number>(currentSeason);

  // Click handler for episode rows — soft-navigates to the player page
  // for the chosen episode using router.replace so the page doesn't
  // remount. The TV watch page reads season/episode from ?s=&e= search
  // params, so the same React instance keeps the player mounted across
  // every episode click.
  function goToEpisode(season: number, ep: number) {
    const qs = new URLSearchParams({ s: String(season), e: String(ep) }).toString();
    router.replace(
      `/watch/tv/${encodeURIComponent(detailPath)}?${qs}`,
      { scroll: false }
    );
  }

  return (
    <div className={cn("flex h-full min-h-0 flex-col", className)}>
      <div className="shrink-0 border-b border-border/60 px-4 py-3">
        <div className="flex items-center gap-2">
          <Tv className="h-4 w-4 text-accent-bright" />
          <h3 className="text-sm font-semibold text-cream">Seasons &amp; Episodes</h3>
        </div>
        <p className="mt-0.5 text-[11px] text-text-muted">
          {list.length} season{list.length === 1 ? "" : "s"} available
        </p>
      </div>

      <ul className="min-h-0 flex-1 overflow-y-auto divide-y divide-border/40">
        {list.map((s) => {
          const isOpen = openSeason === s.season;
          const epNumbers = s.episodes?.length
            ? s.episodes
            : Array.from({ length: Math.max(1, s.episodeCount) }, (_, i) => i + 1);
          const isCurrentSeason = s.season === currentSeason;

          return (
            <li key={s.season}>
              <button
                type="button"
                onClick={() => setOpenSeason(isOpen ? -1 : s.season)}
                className={cn(
                  "group flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-surface-hover",
                  isCurrentSeason && "bg-accent/10"
                )}
                aria-expanded={isOpen}
              >
                <div className="relative h-10 w-14 shrink-0 overflow-hidden rounded-md bg-bg-deepest">
                  {backdropUrl || posterUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={imageUrl(backdropUrl || posterUrl || "") ?? undefined}
                      alt=""
                      className="absolute inset-0 h-full w-full object-cover opacity-60"
                      loading="lazy"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-accent/40 to-bg-deepest">
                      <Film className="h-3.5 w-3.5 text-cream/40" />
                    </div>
                  )}
                  <span className="absolute inset-0 flex items-center justify-center">
                    <span className="rounded bg-bg-deepest/85 px-1.5 py-0.5 text-[10px] font-bold text-cream">
                      S{String(s.season).padStart(2, "0")}
                    </span>
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <p
                    className={cn(
                      "line-clamp-1 text-sm font-semibold",
                      isCurrentSeason ? "text-accent-bright" : "text-text-primary"
                    )}
                  >
                    Season {s.season}
                  </p>
                  <p className="mt-0.5 text-[11px] text-text-muted">
                    {epNumbers.length} episode{epNumbers.length === 1 ? "" : "s"}
                  </p>
                </div>
                <ChevronRight
                  className={cn(
                    "h-4 w-4 text-text-muted transition-transform",
                    isOpen && "rotate-90"
                  )}
                />
              </button>

              {isOpen && (
                <ul className="bg-bg-deepest/40">
                  {epNumbers.length > 24 && (
                    <li className="border-b border-border/30 px-4 py-1.5 text-[10px] uppercase tracking-wider text-text-muted">
                      Showing first 24 of {epNumbers.length} — use search to find more
                    </li>
                  )}
                  {epNumbers.slice(0, 24).map((ep) => {
                    const isCurrent =
                      isCurrentSeason && ep === currentEpisode;
                    return (
                      <li key={`${s.season}-${ep}`}>
                        <button
                          type="button"
                          onClick={() => goToEpisode(s.season, ep)}
                          className={cn(
                            "group flex w-full items-center gap-3 px-4 py-2 text-left text-sm transition-colors hover:bg-surface-hover",
                            isCurrent && "bg-accent/15 text-accent-bright"
                          )}
                        >
                          <span
                            className={cn(
                              "flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-[11px] font-semibold",
                              isCurrent
                                ? "bg-accent text-cream"
                                : "bg-surface-elevated text-text-secondary group-hover:text-cream"
                            )}
                          >
                            {isCurrent ? (
                              <Play className="h-3 w-3 fill-current" />
                            ) : (
                              ep
                            )}
                          </span>
                          <span className="min-w-0 flex-1 truncate">
                            Episode {ep}
                          </span>
                          {isCurrent && (
                            <span className="text-[10px] uppercase tracking-wider text-accent-bright">
                              Now
                            </span>
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
