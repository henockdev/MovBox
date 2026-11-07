import Link from "next/link";
import Image from "next/image";
import { Star } from "lucide-react";
import type { BoxRankingGroup } from "@/lib/data";
import { cleanRankingTitle } from "@/lib/data";
import { toMediaCard } from "@/lib/cards";
import { cn } from "@/lib/utils";

/**
 * The rankings page — the app's ranking system, on the web.
 *
 * The Android app shows two ranking blocks on its Trending tab (*Series
 * Rankings* and *Movie Rankings*), each one a named group of ranked titles
 * with its own "All ›" page and a filter sidebar. This is that page: the
 * same groups, the same order, the same rank badges.
 *
 * The groups come from the upstream's own ranking route, so the order is the
 * upstream's order — nothing here is hand-picked.
 */

/**
 * The rank badge colours, matching the app's ranking badges:
 * pink / orange / gold for the podium, electric blue for the rest.
 */
const RANK_COLORS = ["#FF2D6F", "#FF7A1A", "#FFC220"] as const;
const RANK_COLOR_REST = "#00A8FF";

function RankBadge({ rank }: { rank: number }) {
  const podium = rank <= RANK_COLORS.length;
  const background = podium ? RANK_COLORS[rank - 1] : RANK_COLOR_REST;
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded font-display font-bold leading-none text-white",
        podium ? "h-6 min-w-[3.25rem] px-1.5 text-[11px]" : "h-5 min-w-[1.25rem] px-1 text-[11px]"
      )}
      style={{ backgroundColor: background }}
    >
      {podium ? `TOP ${String(rank).padStart(2, "0")}` : rank}
    </span>
  );
}

/** "2026 | South Korea | Drama, Romance" */
function metaLine(card: ReturnType<typeof toMediaCard>, genre?: string, country?: string) {
  const bits: string[] = [];
  if (card.year) bits.push(card.year);
  const g = (genre || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 2)
    .join(", ");
  if (g) bits.push(g);
  if (country) bits.push(country);
  return bits.join(" | ");
}

export function RankingsView({
  groups,
  activeSlug,
  heading,
}: {
  groups: BoxRankingGroup[];
  activeSlug: string;
  /**
   * The page's <h1>. The index keeps the generic "Movbox Rankings"; every
   * group page passes its own name so each URL has a unique, keyword-bearing
   * heading instead of 22 pages sharing one identical h1.
   */
  heading?: string;
}) {
  const active =
    groups.find((g) => g.slug === activeSlug) ?? groups[0] ?? null;

  if (!active) {
    return (
      <div className="mx-auto max-w-7xl px-4 pb-16 pt-24 md:px-6 lg:px-8">
        <h1 className="font-display text-3xl font-bold text-cream md:text-4xl">
          {heading ?? "Movbox Rankings"}
        </h1>
        <p className="mt-3 max-w-2xl text-text-secondary">
          The rankings are being rebuilt right now. Please check back in a
          moment.
        </p>
      </div>
    );
  }

  const cards = active.items.map(toMediaCard);
  const h1 = heading ?? "Movbox Rankings";

  return (
    <div className="mx-auto max-w-7xl px-4 pb-16 pt-24 md:px-6 lg:px-8">
      <header className="mb-8 md:mb-10">
        <h1 className="font-display text-3xl font-bold text-cream md:text-4xl">
          {h1}
        </h1>
        {heading ? (
          <p className="mt-2 text-sm font-medium uppercase tracking-wider text-accent">
            Movbox Rankings
          </p>
        ) : null}
        <p className="mt-3 max-w-3xl text-sm text-text-secondary md:text-base">
          Every ranking the Movbox app carries, on one page — K-Drama, Anime,
          Action, Horror, Romance, Nollywood and more. Each list is the
          upstream catalogue&rsquo;s own order, refreshed daily, so the number
          one title really is the one everybody is watching.
        </p>
      </header>

      <div className="grid gap-8 lg:grid-cols-[13rem_minmax(0,1fr)] lg:gap-10">
        {/* ---- the group switcher ------------------------------------- */}
        <nav aria-label="Ranking categories">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-text-secondary">
            Rankings
          </h2>

          {/* On a phone the groups are a scrolling chip row; from lg up they
              become the filter sidebar the app uses. */}
          <ul className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-2 no-scrollbar lg:mx-0 lg:hidden">
            {groups.map((g) => (
              <li key={g.slug} className="shrink-0">
                <Link
                  href={`/rankings/${g.slug}`}
                  aria-current={g.slug === active.slug ? "page" : undefined}
                  className={cn(
                    "inline-flex items-center rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors",
                    g.slug === active.slug
                      ? "border-accent bg-brand text-cream"
                      : "border-border bg-surface text-text-secondary hover:border-accent/60 hover:text-cream"
                  )}
                >
                  {g.title}
                </Link>
              </li>
            ))}
          </ul>

          <ul className="hidden space-y-0.5 lg:block">
            {groups.map((g) => {
              const selected = g.slug === active.slug;
              return (
                <li key={g.slug}>
                  <Link
                    href={`/rankings/${g.slug}`}
                    aria-current={selected ? "page" : undefined}
                    className={cn(
                      "group flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors",
                      selected
                        ? "bg-surface font-semibold text-cream"
                        : "text-text-secondary hover:bg-surface/60 hover:text-cream"
                    )}
                  >
                    {/* The brand bar marks the selected filter, exactly like
                        the app's sidebar indicator. */}
                    <span
                      aria-hidden="true"
                      className={cn(
                        "h-4 w-[3px] shrink-0 rounded-full transition-colors",
                        selected
                          ? "bg-accent"
                          : "bg-transparent group-hover:bg-accent/40"
                      )}
                    />
                    <span className="truncate">{g.title}</span>
                    <span className="ml-auto shrink-0 text-xs tabular-nums text-text-secondary/70">
                      {g.items.length}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* ---- the ranked list ----------------------------------------- */}
        <section aria-labelledby="ranking-heading">
          <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
            <h2
              id="ranking-heading"
              className="font-display text-xl font-bold text-cream md:text-2xl"
            >
              {active.title}
            </h2>
            <p className="text-sm text-text-secondary">
              Top {cards.length} &middot; updated daily
            </p>
          </div>

          <ol className="space-y-1">
            {cards.map((card, i) => {
              const source = active.items[i];
              const href = `/${card.type}/${encodeURIComponent(card.id)}`;
              const meta = metaLine(card, source.genre, source.country);
              return (
                <li key={`${card.type}-${card.id}-${i}`}>
                  <Link
                    href={href}
                    className="group flex items-center gap-3 rounded-lg p-2 transition-colors hover:bg-surface md:gap-4 md:p-3"
                  >
                    <div className="relative h-[84px] w-[58px] shrink-0 overflow-hidden rounded-md border border-border bg-card-burgundy md:h-[104px] md:w-[70px]">
                      {card.posterPath ? (
                        <Image
                          src={card.posterPath}
                          alt={card.title}
                          fill
                          sizes="70px"
                          className="object-cover transition-transform duration-500 group-hover:scale-105"
                        />
                      ) : null}
                      <span className="absolute left-1 top-1">
                        <RankBadge rank={i + 1} />
                      </span>
                    </div>

                    <div className="min-w-0 flex-1">
                      <h3 className="truncate font-display text-sm font-bold text-cream md:text-base">
                        {card.title}
                      </h3>
                      <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-text-secondary">
                        {card.rating > 0 ? (
                          <span className="inline-flex items-center gap-1 rounded bg-brand px-1.5 py-0.5 font-semibold text-cream">
                            <Star className="h-3 w-3 fill-accent text-accent" />
                            {card.rating.toFixed(1)}
                          </span>
                        ) : null}
                        {meta ? <span>{meta}</span> : null}
                      </div>
                      {card.overview ? (
                        <p className="mt-1.5 hidden max-w-2xl truncate text-xs text-text-secondary/80 md:block">
                          {card.overview}
                        </p>
                      ) : null}
                    </div>

                    <span className="shrink-0 rounded-full border border-border px-3 py-1 text-xs font-semibold text-cream opacity-0 transition-opacity group-hover:opacity-100">
                      Watch
                    </span>
                  </Link>
                </li>
              );
            })}
          </ol>

          {/* Prose for the generators. A short, factual paragraph in the
              page's own words is what an assistant quotes when it answers
              "what are the best … on Movbox". */}
          <p className="mt-8 max-w-3xl text-sm leading-relaxed text-text-secondary">
            This is the <strong className="text-cream">{cleanRankingTitle(active.title)}</strong>{" "}
            ranking on Movbox — the {cards.length}{" "}
            {cleanRankingTitle(active.title).toLowerCase()} titles in the
            catalogue that are being watched the most, in order. Every title
            links straight to its own page, where the synopsis, the cast, the
            rating and every available episode are listed.
          </p>
        </section>
      </div>
    </div>
  );
}
