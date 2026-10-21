import Link from "next/link";
import Image from "next/image";
import { Play, Star } from "lucide-react";
import { imageUrl } from "@/lib/image";
import { formatRating, formatYear } from "@/lib/format";
import { WatchlistButton } from "@/components/watchlist/WatchlistButton";
import type { MediaCard } from "@/lib/types";
import { cn } from "@/lib/utils";

interface MovieCardProps {
  media: MediaCard;
  className?: string;
  /** Show "+ My List" overlay on hover (default true) */
  withAddButton?: boolean;
  priority?: boolean;
}

/**
 * Compact premium poster card. Sized tightly for mobile so a row
 * shows 3+ cards at once without horizontal scroll fatigue.
 * Golden star rating sits in the top-right with a soft drop-shadow.
 */
export function MovieCard({
  media,
  className,
  withAddButton = true,
  priority = false,
}: MovieCardProps) {
  const href =
    media.type === "movie"
      ? `/movie/${encodeURIComponent(media.id)}`
      : `/tv/${encodeURIComponent(media.id)}`;

  const poster = imageUrl(media.posterPath, "w500");
  const hasRating = media.rating > 0;

  return (
    <Link
      href={href}
      className={cn(
        "group block w-[100px] shrink-0 sm:w-[128px] md:w-[148px] lg:w-[168px]",
        className
      )}
    >
      <div className="relative aspect-[2/3] overflow-hidden rounded-md border border-border bg-surface shadow-card transition-all duration-300 group-hover:scale-[1.025] group-hover:border-accent group-hover:shadow-glow">
        {poster ? (
          <Image
            src={poster ?? undefined}
            alt={media.title}
            fill
            priority={priority}
            sizes="(max-width: 640px) 100px, (max-width: 768px) 128px, (max-width: 1024px) 148px, 168px"
            className="object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div
            className="flex h-full w-full items-center justify-center"
            style={{ background: "#53151e" }}
          >
            <span className="font-display text-[10px] tracking-wide text-cream/40">
              Movbox
            </span>
          </div>
        )}

        {/* Golden star rating — top-right corner, always visible */}
        {hasRating && (
          <div className="absolute right-1 top-1 flex items-center gap-0.5 rounded bg-bg-deepest/80 px-1 py-0.5 text-[9px] font-semibold leading-none text-yellow-400 shadow-md backdrop-blur-sm sm:right-1.5 sm:top-1.5 sm:gap-1 sm:px-1.5 sm:text-[10px]">
            <Star className="h-2.5 w-2.5 fill-yellow-400 text-yellow-400 sm:h-3 sm:w-3" />
            <span>{formatRating(media.rating)}</span>
          </div>
        )}

        {/* Bottom gradient for legibility on hover */}
        <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-bg-deepest/85 via-bg-deepest/40 to-transparent" />

        {/* Play + add buttons on hover */}
        <div className="absolute inset-0 flex items-end justify-between gap-1 p-1.5 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand text-cream shadow-glow sm:h-7 sm:w-7">
            <Play className="h-3 w-3 fill-current sm:h-3.5 sm:w-3.5" />
          </span>
          {withAddButton && <WatchlistButton media={media} size="sm" />}
        </div>
      </div>

      <div className="mt-1 px-0.5">
        <h3 className="line-clamp-1 text-[11px] font-medium text-text-primary transition-colors group-hover:text-cream sm:text-[13px]">
          {media.title}
        </h3>
        <p className="mt-0.5 text-[10px] text-text-muted sm:text-[11px]">
          {formatYear(media.year)}
          {media.runtime
            ? ` · ${Math.floor(media.runtime / 60)}h ${media.runtime % 60}m`
            : ""}
        </p>
      </div>
    </Link>
  );
}
