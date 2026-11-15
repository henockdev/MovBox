"use client";

import { useRef } from "react";
import { Icon } from "@/components/ui/Icon";
import { MovieCard } from "./MovieCard";
import type { MediaCard } from "@/lib/types";
import { cn } from "@/lib/utils";

interface MovieRowProps {
  title: string;
  items: MediaCard[];
  seeAllHref?: string;
  className?: string;
  icon?: React.ReactNode;
  /** Class applied to the icon wrapper (for color/styling overrides). */
  iconClassName?: string;
  /**
   * Kept for API compatibility — set to 0 to disable in-feed sponsored
   * cards. No caller passes it and this row renders pure content; whether
   * a page carries sponsored inventory is decided at the page level.
   */
  adEvery?: number;
  /**
   * How many of the first cards load eagerly.
   *
   * A `priority` poster is fetched at high priority, before the browser has
   * decided what is above the fold. The row used to mark its first **four**
   * cards as priority — on a page with thirty rows that was 132 eagerly
   * fetched posters, which is the opposite of what the flag is for. Only the
   * first row of a page should use it.
   */
  priorityCount?: number;
}

/**
 * Horizontal scroll row with prev/next chevrons on hover.
 * Netflix-style: snap, hide scrollbar, smooth.
 *
 * The per-card href is built inside MovieCard based on the card's own
 * `type` and `id` fields — this row doesn't accept an href prop because
 * functions can't cross the Server→Client Component boundary.
 *
 * This row renders pure content. Any sponsored inventory is placed by
 * the page, not injected between cards.
 */
export function MovieRow({
  title,
  items,
  seeAllHref,
  className,
  icon,
  iconClassName,
  adEvery: _adEvery = 0, // intentionally unused; kept for prop compat
  priorityCount = 0,
}: MovieRowProps) {
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

  return (
    <section className={cn("relative group/row", className)}>
      <header className="mv-row-header">
        <h2 className="mv-row-title font-display">
          {icon && <span className={cn("flex items-center", iconClassName)}>{icon}</span>}
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
        {/* Prev / Next chevrons — appear on hover */}
        <button
          type="button"
          aria-label="Previous"
          onClick={() => scrollBy("left")}
          className="mv-row-nav left-0"
        >
          <Icon name="chevron-left" className="h-6 w-6" />
        </button>
        <button
          type="button"
          aria-label="Next"
          onClick={() => scrollBy("right")}
          className="mv-row-nav right-0"
        >
          <Icon name="chevron-right" className="h-6 w-6" />
        </button>

        <div
          ref={scrollerRef}
          className="mv-row-track"
        >
          {items.map((media, i) => (
            <MovieCard
              key={`${media.type}-${media.id}-${i}`}
              media={media}
              priority={i < priorityCount}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
