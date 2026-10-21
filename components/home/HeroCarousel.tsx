"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Play, Plus, Star, Info } from "lucide-react";
import { imageUrl } from "@/lib/image";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { truncate } from "@/lib/format";
import type { MediaCard } from "@/lib/types";
import { cn } from "@/lib/utils";

interface HeroCarouselProps {
  items: MediaCard[];
  interval?: number;
}

/**
 * Compact, premium hero. Sized so the first content row sits in the
 * initial viewport — the user can see what's trending immediately.
 * Fade transitions, manual prev/next + dot indicators, auto-advance.
 */
export function HeroCarousel({ items, interval = 7000 }: HeroCarouselProps) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  const goTo = useCallback(
    (i: number) => {
      setIndex(((i % items.length) + items.length) % items.length);
    },
    [items.length]
  );
  const next = useCallback(() => goTo(index + 1), [goTo, index]);
  const prev = useCallback(() => goTo(index - 1), [goTo, index]);

  useEffect(() => {
    if (paused || items.length < 2) return;
    const t = setInterval(next, interval);
    return () => clearInterval(t);
  }, [paused, next, interval, items.length]);

  if (!items.length) return null;

  const current = items[index];
  const watchHref =
    current.type === "movie"
      ? `/watch/movie/${encodeURIComponent(current.id)}`
      : `/watch/tv/${encodeURIComponent(current.id)}`;

  return (
    <section
      aria-label="Featured premieres"
      className="relative h-[42vh] min-h-[300px] w-full overflow-hidden sm:h-[46vh] sm:min-h-[340px] md:h-[52vh] md:min-h-[400px] lg:h-[58vh] lg:min-h-[440px]"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {/* Backdrop slides — full-bleed cover, smooth fade. */}
      {items.map((m, i) => {
        const bg =
          imageUrl(m.backdropPath, "original") ?? imageUrl(m.posterPath, "w1280");
        return (
          <div
            key={m.id}
            aria-hidden={i !== index}
            className={cn(
              "absolute inset-0 transition-opacity duration-1000 ease-in-out",
              i === index ? "opacity-100" : "opacity-0"
            )}
          >
            {bg ? (
              <Image
                src={bg}
                alt={m.title}
                fill
                priority={i === 0}
                sizes="100vw"
                className="object-cover object-[center_30%]"
              />
            ) : (
              <div
                className="absolute inset-0"
                style={{
                  background:
                    "linear-gradient(135deg, rgba(128, 0, 32, 0.55), rgba(13, 9, 9, 0.95))",
                }}
              />
            )}
            <div className="absolute inset-0 bg-gradient-to-r from-bg-deepest/85 via-bg-deepest/40 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-bg-deepest via-bg-deepest/60 to-transparent" />
          </div>
        );
      })}

      {/* Content */}
      <div className="relative z-10 mx-auto flex h-full max-w-7xl items-end px-3 pb-8 sm:px-5 sm:pb-10 md:px-6 md:pb-14 lg:px-8 lg:pb-16">
        <div key={current.id} className="max-w-2xl animate-fade-in-up">
          <Badge variant="premiere" className="mb-2 text-[9px] sm:mb-3 sm:text-[10px]">
            Exclusive Premiere
          </Badge>
          <h1 className="font-display text-xl font-bold leading-[1.05] text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.7)] sm:text-2xl md:text-4xl lg:text-5xl">
            {current.title}
          </h1>
          {current.overview && (
            <p className="mt-2 hidden max-w-xl text-sm text-text-primary/95 drop-shadow-[0_1px_4px_rgba(0,0,0,0.6)] md:mt-3 md:block md:text-base">
              {truncate(current.overview, 200)}
            </p>
          )}

          <div className="mt-2 hidden flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-text-primary md:mt-3 md:flex">
            {current.rating > 0 && (
              <span className="flex items-center gap-1 font-semibold text-cream">
                <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                {current.rating.toFixed(1)}
              </span>
            )}
            {current.year && <span>{current.year}</span>}
            <span className="rounded border border-border bg-surface-elevated/80 px-1.5 py-0.5 text-[10px] font-bold tracking-wide">
              4K Ultra HD
            </span>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-1.5 sm:mt-4 sm:gap-2 md:mt-5 md:gap-3">
            <Button asChild variant="primary" size="sm" className="shadow-glow md:size-md">
              <Link href={watchHref}>
                <Play className="h-3.5 w-3.5 fill-current md:h-4 md:w-4" />
                Watch Now
              </Link>
            </Button>
            <Button variant="secondary" size="sm" className="hidden sm:inline-flex md:size-md">
              <Plus className="h-3.5 w-3.5 md:h-4 md:w-4" />
              My List
            </Button>
            <Button asChild variant="ghost" size="sm" className="hidden text-text-primary sm:inline-flex md:size-md">
              <Link href={watchHref}>
                <Info className="h-3.5 w-3.5 md:h-4 md:w-4" />
                More Info
              </Link>
            </Button>
          </div>
        </div>
      </div>

      {/* Side chevrons */}
      <button
        type="button"
        aria-label="Previous slide"
        onClick={prev}
        className="absolute left-3 top-1/2 z-20 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-bg-deepest/60 text-text-primary backdrop-blur transition-opacity hover:border-accent hover:bg-brand md:flex"
      >
        <ChevronLeft className="h-5 w-5" />
      </button>
      <button
        type="button"
        aria-label="Next slide"
        onClick={next}
        className="absolute right-3 top-1/2 z-20 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-bg-deepest/60 text-text-primary backdrop-blur transition-opacity hover:border-accent hover:bg-brand md:flex"
      >
        <ChevronRight className="h-5 w-5" />
      </button>

      {/* Dot indicators */}
      <div className="absolute bottom-3 left-1/2 z-20 flex -translate-x-1/2 items-center gap-1.5 md:bottom-4">
        {items.map((m, i) => (
          <button
            key={m.id}
            type="button"
            aria-label={`Go to slide ${i + 1}`}
            onClick={() => goTo(i)}
            className={cn(
              "h-1 rounded-full transition-all",
              i === index
                ? "w-7 bg-cream"
                : "w-1.5 bg-text-muted/50 hover:bg-text-secondary"
            )}
          />
        ))}
      </div>
    </section>
  );
}
