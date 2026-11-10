import Link from "next/link";
import { baseShowTitle } from "@/lib/seo";
import { cn } from "@/lib/utils";

/**
 * The episode index — the server-rendered link graph for a series.
 *
 * ## Why this exists
 *
 * The Ahrefs site audit reported **4 374 orphan pages** — pages with no
 * incoming internal link — out of 4 377 errors. Every one of them was an
 * episode watch page.
 *
 * The reason was that the episode picker is a client component: it renders
 * `<button>` elements and calls `router.replace()`. The served HTML of a
 * series page contained exactly ONE link to an episode (`?s=1&e=1`), and the
 * served HTML of a watch page contained NONE. So 25 013 episode urls were
 * published in the sitemap and linked from nowhere — a sitemap entry is not
 * an internal link, and a crawler that finds nothing linking to a page has
 * no reason to keep it.
 *
 * This component renders the same list as real `<a href>` anchors, on the
 * server, so every episode is linked from every sibling episode and from the
 * series page. The crawl graph becomes connected, and the long-tail queries
 * ("watch <show> season 3 episode 5") have somewhere to land.
 *
 * It is a `<details>` element on purpose: the links are in the served HTML
 * (a crawler reads them) but the block stays collapsed until the visitor
 * opens it, so the page is not a wall of 60 numbers.
 */

export interface EpisodeIndexSeason {
  season: number;
  episodeCount: number;
  episodes?: number[] | null;
}

export interface EpisodeIndexProps {
  detailPath: string;
  showTitle: string;
  seasons: EpisodeIndexSeason[];
  className?: string;
}

export function EpisodeIndex({
  detailPath,
  showTitle,
  seasons,
  className,
}: EpisodeIndexProps) {
  const usable = (seasons ?? [])
    .map((s) => {
      const eps =
        s.episodes && s.episodes.length
          ? [...new Set(s.episodes)].sort((a, b) => a - b)
          : Array.from({ length: Math.max(0, s.episodeCount || 0) }, (_, i) => i + 1);
      return { season: s.season, episodes: eps };
    })
    .filter((s) => s.episodes.length > 0)
    .sort((a, b) => a.season - b.season);

  if (!usable.length) return null;

  const total = usable.reduce((n, s) => n + s.episodes.length, 0);
  const show = baseShowTitle(showTitle) || showTitle;

  return (
    <section
      aria-label={`All episodes of ${show}`}
      className={cn("mt-8 rounded-xl border border-border bg-surface/40 p-4 sm:p-5", className)}
    >
      <details>
        <summary className="cursor-pointer list-none text-sm font-semibold text-cream marker:hidden">
          <span className="inline-flex items-center gap-2">
            <span
              aria-hidden
              className="inline-block transition-transform duration-200 [details[open]_&]:rotate-90"
            >
              ›
            </span>
            All {total} episodes
            <span className="text-xs font-normal text-text-secondary">
              across {usable.length} season{usable.length === 1 ? "" : "s"}
            </span>
          </span>
        </summary>

        <div className="mt-4 space-y-5">
          {usable.map((s) => (
            <div key={s.season}>
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-text-secondary">
                Season {s.season}
                <span className="ml-2 font-normal normal-case tracking-normal text-text-muted">
                  {s.episodes.length} episodes
                </span>
              </h2>
              <ul className="flex flex-wrap gap-1.5">
                {s.episodes.map((ep) => (
                  <li key={ep}>
                    <Link
                      href={`/watch/tv/${encodeURIComponent(
                        detailPath
                      )}?s=${s.season}&e=${ep}`}
                      title={`${show} — Season ${s.season} Episode ${ep}`}
                      className="inline-flex h-8 min-w-[2rem] items-center justify-center rounded-md border border-border bg-bg-deepest px-1.5 text-xs font-semibold text-text-secondary transition-colors hover:border-accent hover:text-cream"
                    >
                      {ep}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </details>

      {/* The prose an assistant quotes when it is asked "how many episodes
          of <show> are on Movbox". Factual, and derived from the catalogue. */}
      <p className="mt-4 text-xs leading-relaxed text-text-secondary">
        <strong className="text-cream">{show}</strong> has {total} episodes
        across {usable.length} season{usable.length === 1 ? "" : "s"} on Movbox
        — every episode is listed above and streams free in HD with subtitles
        where the source provides them.
      </p>
    </section>
  );
}
