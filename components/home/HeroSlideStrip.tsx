"use client";

import Image from "next/image";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Play } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { imageUrl } from "@/lib/image";
import { formatYear } from "@/lib/format";
import type { MediaCard } from "@/lib/types";
import { cn } from "@/lib/utils";

interface HeroSlideStripProps {
  items: MediaCard[];
  /**
   * The slide the banner is currently showing.
   *
   * In the app the banner and the strip share one carousel state: the strip
   * highlights the live slide, and tapping a strip card moves the banner.
   */
  activeIndex?: number;
  /** Called when a strip card is tapped. */
  onSelect?: (index: number) => void;
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
 * What the web adds on top of the native scroll-snap:
 *   - it can be **dragged with the mouse**, so a desktop visitor gets the
 *     same gesture the phone gets,
 *   - it carries **arrow buttons** and **edge fades**, so it reads as
 *     scrollable instead of looking like a row that happens to be cut off,
 *   - it **follows the banner**: the live slide is highlighted and scrolled
 *     into view, and tapping a card moves the banner — the app's behaviour.
 */
export function HeroSlideStrip({
  items,
  activeIndex,
  onSelect,
  className,
}: HeroSlideStripProps) {
  const trackRef = useRef<HTMLUListElement | null>(null);
  const cardRefs = useRef<(HTMLLIElement | null)[]>([]);
  const drag = useRef({
    down: false,
    moved: false,
    startX: 0,
    startScroll: 0,
    pointerId: -1,
  });
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(false);
  const [dragging, setDragging] = useState(false);

  // Edge fades and the arrow buttons both need to know where we are.
  const syncEdges = useCallback(() => {
    const el = trackRef.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    setAtStart(el.scrollLeft <= 4);
    setAtEnd(el.scrollLeft >= max - 4);
  }, []);

  useEffect(() => {
    syncEdges();
    const el = trackRef.current;
    if (!el) return;
    el.addEventListener("scroll", syncEdges, { passive: true });
    window.addEventListener("resize", syncEdges);
    return () => {
      el.removeEventListener("scroll", syncEdges);
      window.removeEventListener("resize", syncEdges);
    };
  }, [syncEdges, items.length]);

  // Follow the banner: bring the live card into view.
  useEffect(() => {
    if (typeof activeIndex !== "number") return;
    const card = cardRefs.current[activeIndex];
    if (!card) return;
    card.scrollIntoView({
      behavior: "smooth",
      inline: "center",
      block: "nearest",
    });
  }, [activeIndex]);

  const scrollByCards = useCallback((direction: 1 | -1) => {
    const el = trackRef.current;
    if (!el) return;
    const card = el.querySelector<HTMLElement>("li");
    const step = card ? card.offsetWidth + 16 : el.clientWidth * 0.8;
    el.scrollBy({ left: direction * step, behavior: "smooth" });
  }, []);

  const onPointerDown = (e: React.PointerEvent<HTMLUListElement>) => {
    if (e.pointerType !== "mouse") return;
    const el = trackRef.current;
    if (!el) return;
    drag.current = {
      down: true,
      moved: false,
      startX: e.clientX,
      startScroll: el.scrollLeft,
      pointerId: e.pointerId,
    };
  };

  const onPointerMove = (e: React.PointerEvent<HTMLUListElement>) => {
    const el = trackRef.current;
    if (!el || !drag.current.down) return;
    const dx = e.clientX - drag.current.startX;
    if (Math.abs(dx) > 4) {
      if (!drag.current.moved) {
        drag.current.moved = true;
        setDragging(true);
        el.setPointerCapture(e.pointerId);
      }
      el.scrollLeft = drag.current.startScroll - dx;
    }
  };

  const endDrag = (e: React.PointerEvent<HTMLUListElement>) => {
    if (!drag.current.down) return;
    drag.current.down = false;
    if (drag.current.moved) {
      setDragging(false);
      // Swallow the click that follows a drag so the strip does not open a
      // title the visitor only meant to scroll past.
      const target = e.currentTarget;
      const swallow = (ev: MouseEvent) => {
        ev.preventDefault();
        ev.stopPropagation();
        target.removeEventListener("click", swallow, true);
      };
      target.addEventListener("click", swallow, true);
      setTimeout(() => target.removeEventListener("click", swallow, true), 60);
    }
  };

  if (!items.length) return null;

  return (
    <nav
      aria-label="Featured titles"
      className={cn("relative w-full", className)}
    >
      {/* ---- edge fades: the row reads as scrollable ---- */}
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-y-0 left-0 z-10 w-10 bg-gradient-to-r from-bg-deepest to-transparent transition-opacity duration-300 sm:w-16",
          atStart ? "opacity-0" : "opacity-100"
        )}
      />
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-y-0 right-0 z-10 w-10 bg-gradient-to-l from-bg-deepest to-transparent transition-opacity duration-300 sm:w-16",
          atEnd ? "opacity-0" : "opacity-100"
        )}
      />

      <ul
        ref={trackRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        className={cn(
          "no-scrollbar flex snap-x snap-mandatory gap-2.5 overflow-x-auto scroll-smooth px-3 pb-2 sm:gap-3 sm:px-5 md:gap-4 md:px-6 lg:px-8",
          dragging ? "cursor-grabbing snap-none" : "cursor-grab"
        )}
        style={{ scrollPaddingLeft: "0.75rem" }}
      >
        {items.map((media, i) => {
          const href =
            media.type === "movie"
              ? `/movie/${encodeURIComponent(media.id)}`
              : `/tv/${encodeURIComponent(media.id)}`;
          const poster = imageUrl(media.posterPath, "w185");
          const kind = media.type === "movie" ? "Movie" : "TV Series";
          const year = formatYear(media.year);
          const meta = media.subline || [year, kind].filter(Boolean).join(" · ");
          const active = i === activeIndex;

          return (
            <li
              key={`${media.type}-${media.id}-${i}`}
              ref={(el) => {
                cardRefs.current[i] = el;
              }}
              className="w-[248px] shrink-0 snap-start sm:w-[288px] md:w-[300px]"
            >
              <Link
                href={href}
                onClick={() => onSelect?.(i)}
                aria-current={active ? "true" : undefined}
                className={cn(
                  "group flex h-[74px] items-center gap-2.5 rounded-xl border bg-surface-elevated p-2 shadow-card transition-all duration-300 hover:border-accent hover:shadow-glow sm:h-[84px] sm:gap-3 sm:p-2.5",
                  active
                    ? "border-accent bg-surface-hover shadow-glow"
                    : "border-border"
                )}
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

      {/* ---- arrow buttons ---- */}
      {items.length > 2 ? (
        <>
          <button
            type="button"
            onClick={() => scrollByCards(-1)}
            disabled={atStart}
            aria-label="Scroll the featured titles left"
            className={cn(
              "absolute left-2 top-1/2 z-20 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-bg-primary/90 text-cream shadow-elevated backdrop-blur transition-all duration-200 md:flex",
              atStart
                ? "pointer-events-none opacity-0"
                : "opacity-100 hover:border-accent hover:bg-surface-hover"
            )}
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={() => scrollByCards(1)}
            disabled={atEnd}
            aria-label="Scroll the featured titles right"
            className={cn(
              "absolute right-2 top-1/2 z-20 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-bg-primary/90 text-cream shadow-elevated backdrop-blur transition-all duration-200 md:flex",
              atEnd
                ? "pointer-events-none opacity-0"
                : "opacity-100 hover:border-accent hover:bg-surface-hover"
            )}
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </>
      ) : null}
    </nav>
  );
}
