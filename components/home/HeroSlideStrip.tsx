import Link from "next/link";
import Image from "next/image";
import { Play } from "lucide-react";
import { imageUrl } from "@/lib/image";
import { formatYear } from "@/lib/format";
import type { MediaCard } from "@/lib/types";
import { cn } from "@/lib/utils";

interface HeroSlideStripProps {
  items: MediaCard[];
  className?: string;
}

/**
 * The compact slider strip under the hero.
 *
 * The original app renders its hero slides a second time as thin cards —
 * thumbnail, title, `year | genre` and a round play button — directly under
 * the 16:9 hero banner. The strip doubles as the slider control and as the
 * "play this" affordance, and it is the app's main horizontal-scroll
 * gesture on a phone.
 *
 * The website already had the banner (`HeroCarousel`) and the content rows
 * (`MovieRow`); this is the piece that was missing. It is deliberately a
 * server component: the horizontal movement is native CSS scroll-snap, so
 * there is no client JavaScript to ship and touch gestures work as the
 * platform intends.
 */
export function HeroSlideStrip({ items, className }: HeroSlideStripProps) {
  if (!items.length) return null;

  return (
    <nav
      aria-label="Featured titles"
      className={cn("relative w-full", className)}
    >
      <ul
        className="no-scrollbar flex snap-x snap-mandatory gap-2.5 overflow-x-auto scroll-smooth px-3 pb-2 sm:gap-3 sm:px-5 md:gap-4 md:px-6 lg:px-8"
        style={{ scrollPaddingLeft: "0.75rem" }}
      >
        {items.map((media, i) => {
          const href =
            media.type === "movie"
              ? `/movie/${encodeURIComponent(media.id)}`
              : `/tv/${encodeURIComponent(media.id)}`;
          const poster = imageUrl(media.posterPath, "w500");
          const kind = media.type === "movie" ? "Movie" : "TV Series";
          const year = formatYear(media.year);
          const meta = [year, kind].filter(Boolean).join(" · ");

          return (
            <li
              key={`${media.type}-${media.id}-${i}`}
              className="w-[248px] shrink-0 snap-start sm:w-[288px] md:w-[300px]"
            >
              <Link
                href={href}
                className="group flex h-[74px] items-center gap-2.5 rounded-xl border border-border bg-surface-elevated p-2 shadow-card transition-all duration-300 hover:border-accent hover:shadow-glow sm:h-[84px] sm:gap-3 sm:p-2.5"
              >
                {/* Thumbnail */}
                <div className="relative h-[54px] w-[36px] shrink-0 overflow-hidden rounded-md bg-card-burgundy sm:h-[62px] sm:w-[44px]">
                  {poster ? (
                    <Image
                      src={poster}
                      alt=""
                      fill
                      priority={i < 5}
                      sizes="44px"
                      className="object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center font-display text-[8px] text-cream/40">
                      Movbox
                    </span>
                  )}
                </div>

                {/* Title + meta */}
                <div className="min-w-0 flex-1">
                  <h3 className="line-clamp-2 text-[12px] font-bold leading-tight text-cream sm:text-[13px]">
                    {media.title}
                  </h3>
                  {meta && (
                    <p className="mt-1 truncate text-[10px] text-text-muted sm:text-[11px]">
                      {meta}
                    </p>
                  )}
                </div>

                {/* Play affordance */}
                <span
                  aria-hidden
                  className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full bg-brand text-cream shadow-glow transition-transform duration-300 group-hover:scale-105 sm:h-[34px] sm:w-[34px]"
                >
                  <Play className="h-3.5 w-3.5 fill-current sm:h-4 sm:w-4" />
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
