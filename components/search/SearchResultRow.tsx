import Image from "next/image";
import Link from "next/link";
import { Star } from "lucide-react";
import { imageUrl } from "@/lib/image";
import { genreList } from "@/lib/search";
import type { SearchCard } from "@/lib/search";
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
      className="inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-[5px] px-1 font-display text-[11px] font-bold leading-none text-white shadow-md"
      style={{
        backgroundColor: podium ? RANK_COLORS[rank - 1] : RANK_COLOR_REST,
      }}
    >
      {rank}
    </span>
  );
}

/**
 * One result row — the app's row, exactly.
 *
 * The poster carries the rank badge, the title sits next to it, and the meta
 * line under the title holds the score, the year, the country and the genre.
 */
export function SearchResultRow({
  card,
  rank,
  className,
}: {
  card: SearchCard;
  rank: number;
  className?: string;
}) {
  const href =
    card.type === "movie"
      ? `/movie/${encodeURIComponent(card.id)}`
      : `/tv/${encodeURIComponent(card.id)}`;
  const poster = imageUrl(card.posterUrl, "w342");

  const meta = [
    card.year ? String(card.year) : "",
    card.country,
    genreList(card).join(", "),
  ]
    .filter(Boolean)
    .join(" | ");

  return (
    <Link
      href={href}
      className={cn(
        "group flex items-center gap-3 rounded-xl px-1.5 py-2 transition-colors duration-200 hover:bg-surface/80 sm:gap-4 sm:px-2",
        className
      )}
    >
      <div className="relative h-[81px] w-[54px] shrink-0 overflow-hidden rounded-lg bg-card-burgundy shadow-card ring-1 ring-border/60 transition-all duration-300 group-hover:ring-accent/60 sm:h-[90px] sm:w-[60px]">
        {poster ? (
          <Image
            src={poster}
            alt=""
            fill
            sizes="60px"
            className="object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <span className="flex h-full w-full items-center justify-center font-display text-[9px] text-cream/40">
            Movbox
          </span>
        )}
        <span className="absolute left-1 top-1">
          <RankBadge rank={rank} />
        </span>
      </div>

      <div className="min-w-0 flex-1">
        <h3 className="truncate text-[14px] font-semibold text-cream transition-colors group-hover:text-vanilla sm:text-[15px]">
          {card.title}
        </h3>
        <div className="mt-1.5 flex items-center gap-2">
          {card.rating != null && card.rating > 0 ? (
            <span className="inline-flex items-center gap-1 rounded bg-brand px-1.5 py-0.5 text-[10px] font-bold leading-none text-cream">
              <Star className="h-[11px] w-[11px] fill-current" />
              {card.rating.toFixed(1)}
            </span>
          ) : null}
          {meta ? (
            <p className="truncate text-[11.5px] text-text-muted sm:text-[12px]">
              {meta}
            </p>
          ) : null}
        </div>
      </div>
    </Link>
  );
}
