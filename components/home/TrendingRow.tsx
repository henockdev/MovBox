"use client";

import { useRef } from "react";
import { ChevronLeft, ChevronRight, Film, Tv, Flame, Sparkles } from "lucide-react";
import { MovieCard } from "./MovieCard";
import type { MediaCard } from "@/lib/types";
import { cn } from "@/lib/utils";

export type TrendingIconName = "film" | "tv" | "flame" | "sparkles";

interface TrendingRowProps {
  title: string;
  iconName?: TrendingIconName;
  iconClassName?: string;
  items: MediaCard[];
  seeAllHref?: string;
}

const ICONS: Record<TrendingIconName, React.ElementType> = {
  film: Film,
  tv: Tv,
  flame: Flame,
  sparkles: Sparkles,
};

/**
 * Horizontal scroll row with chevrons — like MovieRow but the icon is
 * picked by name (string) so a Server Component can hand it in.
 */
export function TrendingRow({
  title,
  iconName,
  iconClassName,
  items,
  seeAllHref,
}: TrendingRowProps) {
  const scrollerRef = useRef<HTMLDivElement>(null);

  function scrollBy(dir: "left" | "right") {
    const el = scrollerRef.current;
    if (!el) return;
    const amount = el.clientWidth * 0.85;
    el.scrollBy({
      left: dir === "left" ? -amount : amount,
      behavior: "smooth",
    });
  }

  if (!items.length) return null;

  const Icon = iconName ? ICONS[iconName] : null;

  return (
    <section className="relative group/row">
      <header className="mb-4 flex items-end justify-between gap-4 px-4 md:px-6 lg:px-8">
        <h2 className="flex items-center gap-2 font-display text-xl font-bold text-cream md:text-2xl">
          {Icon && <Icon className={cn("h-5 w-5 md:h-6 md:w-6", iconClassName)} />}
          <span>{title}</span>
        </h2>
        {seeAllHref && (
          <a
            href={seeAllHref}
            className="text-sm font-medium text-accent-bright transition-colors hover:text-cream"
          >
            View All
          </a>
        )}
      </header>

      <div className="relative">
        <button
          type="button"
          aria-label="Previous"
          onClick={() => scrollBy("left")}
          className="absolute left-0 top-1/2 z-10 hidden h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-bg-deepest/80 text-text-primary opacity-0 backdrop-blur transition-opacity hover:border-accent hover:bg-brand md:flex group-hover/row:opacity-100"
        >
          <ChevronLeft className="h-6 w-6" />
        </button>
        <button
          type="button"
          aria-label="Next"
          onClick={() => scrollBy("right")}
          className="absolute right-0 top-1/2 z-10 hidden h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-bg-deepest/80 text-text-primary opacity-0 backdrop-blur transition-opacity hover:border-accent hover:bg-brand md:flex group-hover/row:opacity-100"
        >
          <ChevronRight className="h-6 w-6" />
        </button>

        <div
          ref={scrollerRef}
          className="no-scrollbar flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-smooth px-4 pb-2 md:gap-4 md:px-6 lg:px-8"
        >
          {items.map((media, i) => (
            <MovieCard
              key={`${media.type}-${media.id}`}
              media={media}
              priority={i < 4}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
