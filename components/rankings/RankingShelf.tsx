"use client";

/**
 * The ranking shelf — the app's ranking block, on every browse screen.
 *
 * The Android app puts a ranking block on EVERY tab. It is a row of chips —
 * the upstream's own ranking groups — over a numbered row of posters, and
 * switching a chip swaps the ranked list.
 *
 * Every group's titles are already in the page, so switching a chip is
 * instant and offline; nothing is re-fetched and no spinner is shown. The
 * rank badge is the group's own position in the upstream's list, so the
 * number on a poster really is that title's rank.
 */

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { Trophy } from "lucide-react";
import type { RankingShelfGroup } from "@/lib/ranking-shelf";
import { cn } from "@/lib/utils";

/**
 * The rank badge colours, matching the app's ranking badges:
 * pink / orange / gold for the podium, electric blue for the rest.
 */
const RANK_COLORS = ["#FF2D6F", "#FF7A1A", "#FFC220"] as const;
const RANK_COLOR_REST = "#00A8FF";

function RankBadge({ rank }: { rank: number }) {
  const podium = rank <= RANK_COLORS.length;
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded font-display font-bold leading-none text-white shadow-md",
        podium
          ? "h-6 min-w-[3.25rem] px-1.5 text-[11px]"
          : "h-5 min-w-[1.25rem] px-1 text-[11px]"
      )}
      style={{
        backgroundColor: podium ? RANK_COLORS[rank - 1] : RANK_COLOR_REST,
      }}
    >
      {podium ? `TOP ${String(rank).padStart(2, "0")}` : rank}
    </span>
  );
}

export interface RankingShelfProps {
  groups: RankingShelfGroup[];
  /** The block's own heading — the app calls them "Series Rankings" / "Movie Rankings". */
  title?: string;
  /** Where "See all" points. */
  seeAllHref?: string;
  className?: string;
}

export function RankingShelf({
  groups,
  title = "Top Picks",
  seeAllHref = "/rankings",
  className,
}: RankingShelfProps) {
  const [active, setActive] = useState(0);

  if (!groups.length) return null;

  const current = groups[Math.min(active, groups.length - 1)];

  return (
    <section
      aria-label="Rankings"
      className={cn(
        "rounded-2xl border border-border bg-surface/40 p-4 sm:p-5",
        className
      )}
    >
      <div className="mb-3 flex items-end justify-between gap-3">
        <h2 className="flex items-center gap-2 font-display text-lg font-bold text-cream sm:text-xl">
          <Trophy className="h-5 w-5 text-accent-bright" aria-hidden />
          {title}
        </h2>
        <Link
          href={seeAllHref}
          className="shrink-0 text-xs font-medium text-accent transition-colors hover:text-cream sm:text-sm"
        >
          See all rankings &rarr;
        </Link>
      </div>

      {/* The chips — the upstream's own ranking groups. */}
      <div className="no-scrollbar -mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:-mx-5 sm:px-5">
        {groups.map((g, i) => {
          const selected = i === Math.min(active, groups.length - 1);
          return (
            <button
              key={g.slug}
              type="button"
              onClick={() => setActive(i)}
              aria-pressed={selected}
              className={cn(
                "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors sm:text-sm",
                selected
                  ? "border-accent bg-brand text-cream"
                  : "border-border bg-surface text-text-secondary hover:border-accent/60 hover:text-cream"
              )}
            >
              {g.title}
              <span
                className={cn(
                  "text-[10px] tabular-nums",
                  selected ? "text-cream/70" : "text-text-secondary/60"
                )}
              >
                {g.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* The ranked row — one horizontal strip, like the app's ranked poster
          row. It never wraps into a second row: the visitor scrolls sideways
          through the whole ranking, and the strip is the page's main
          horizontal gesture on a phone. */}
      <ol className="no-scrollbar -mx-4 flex snap-x snap-mandatory gap-2.5 overflow-x-auto px-4 pb-2 sm:-mx-5 sm:gap-3 sm:px-5">
        {current.items.map((item, i) => {
          const href = `/${item.type}/${encodeURIComponent(item.id)}`;
          return (
            <li
              key={`${item.id}-${i}`}
              className="w-[104px] shrink-0 snap-start sm:w-[124px] md:w-[136px]"
            >
              <Link
                href={href}
                className="group relative block overflow-hidden rounded-lg bg-card-burgundy"
                title={item.title}
              >
                <div className="relative aspect-[2/3] w-full">
                  {item.posterUrl ? (
                    <Image
                      src={item.posterUrl}
                      alt={item.title}
                      fill
                      sizes="(max-width: 640px) 104px, (max-width: 768px) 124px, 136px"
                      className="object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center px-2 text-center text-[10px] text-cream/40">
                      {item.title}
                    </div>
                  )}
                </div>

                <span className="absolute left-1 top-1">
                  <RankBadge rank={i + 1} />
                </span>

                {/* The title and its meta, the way the app's ranking row
                    labels each poster. */}
                <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent px-1.5 pb-1.5 pt-6">
                  <span className="block truncate text-[10px] font-bold leading-tight text-cream sm:text-[11px]">
                    {item.title}
                  </span>
                  {item.year ? (
                    <span className="mt-0.5 block truncate text-[9px] text-cream/70 sm:text-[10px]">
                      {item.year}
                      {item.rating ? ` · ★ ${item.rating.toFixed(1)}` : ""}
                    </span>
                  ) : null}
                </span>
              </Link>
            </li>
          );
        })}
      </ol>

      <p className="mt-4 text-[11px] text-text-secondary">
        Ranked by the Movbox catalogue &middot; {current.count} titles in{" "}
        {current.title} &middot;{" "}
        <Link
          href={`/rankings/${current.slug}`}
          className="font-medium text-accent hover:text-cream"
        >
          See the full {current.title} list &rarr;
        </Link>
      </p>
    </section>
  );
}
