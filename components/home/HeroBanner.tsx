"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { HeroBannerSlide } from "@/lib/hero";
import { cn } from "@/lib/utils";

export type { HeroBannerSlide };

interface HeroBannerProps {
  slides: HeroBannerSlide[];
  /** Milliseconds between auto-advances. The app uses 5000. */
  interval?: number;
  /**
   * The heading level of the active slide's title.
   *
   * The homepage has no other heading, so the active slide carries the page's
   * `<h1>`. A page that already has one — `/trending` — passes "h2" so the
   * document still has exactly one `<h1>`.
   */
  headingLevel?: "h1" | "h2";
  /**
   * Controlled active slide.
   *
   * When this is supplied the banner is driven from the outside — that is
   * how the strip under it becomes the pager control, exactly as it is in
   * the app, where the banner and the strip share one carousel state.
   */
  activeIndex?: number;
  /** Told whenever the visible slide changes, however it changed. */
  onActiveChange?: (index: number) => void;
  className?: string;
}

/**
 * The app's Trending hero.
 *
 * The Android app opens on its Trending tab and the first thing on it is a
 * full-bleed 16:9 banner that advances on its own every five seconds, with a
 * compact strip of the same slides directly underneath. The artwork comes from
 * the upstream's own `BANNER` block — the same one the app reads — so this is
 * the app's hero, not an approximation of it.
 *
 * Behaviour copied from the app:
 *   - the banner advances every 5 s
 *   - it never fights a swipe that is still in progress
 *   - it can be dragged sideways like a pager
 *
 * Two web-specific additions, both invisible unless you interact with it:
 *   - the advance pauses while the pointer is over the banner, while it has
 *     keyboard focus, and while the tab is in the background
 *   - `prefers-reduced-motion` turns the automatic advance off entirely
 *
 * The scroll track is the single source of truth for which slide is showing,
 * so a swipe and the auto-advance can never disagree about the state.
 */
export function HeroBanner({
  slides,
  interval = 5000,
  headingLevel = "h1",
  activeIndex,
  onActiveChange,
  className,
}: HeroBannerProps) {
  const count = slides.length;
  const trackRef = useRef<HTMLDivElement | null>(null);
  const slideRefs = useRef<(HTMLDivElement | null)[]>([]);
  const dragging = useRef(false);
  const [internalActive, setInternalActive] = useState(0);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);

  const controlled = typeof activeIndex === "number";
  const active = controlled ? (activeIndex as number) : internalActive;

  /**
   * The slide the visitor can actually see right now.
   *
   * The observer writes it; the "follow the controlled index" effect reads it
   * to decide whether a scroll is still needed. Without it, a swipe would be
   * fought by the effect that scrolls to the requested slide.
   */
  const viewRef = useRef(0);

  const setActive = useCallback(
    (index: number) => {
      if (!controlled) setInternalActive(index);
      onActiveChange?.(index);
    },
    [controlled, onActiveChange]
  );

  const scrollTo = useCallback((index: number, smooth: boolean) => {
    const track = trackRef.current;
    const slide = slideRefs.current[index];
    if (!track || !slide) return;
    track.scrollTo({
      left: slide.offsetLeft,
      behavior: smooth ? "smooth" : "auto",
    });
  }, []);

  // Which slide is on screen. The observer watches the track, so the dots and
  // the auto-advance always agree with what the visitor can actually see.
  useEffect(() => {
    const track = trackRef.current;
    if (!track || typeof IntersectionObserver === "undefined") return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const index = Number((entry.target as HTMLElement).dataset.index);
          if (Number.isFinite(index)) {
            viewRef.current = index;
            setActive(index);
          }
        }
      },
      { root: track, threshold: 0.6 }
    );

    for (const el of slideRefs.current) if (el) observer.observe(el);
    return () => observer.disconnect();
  }, [count, setActive]);

  // Follow a slide requested from outside — the strip under the banner, or
  // the dots. A swipe is never fought: the observer has already moved
  // `viewRef` by then, so the effect does nothing.
  useEffect(() => {
    if (!controlled) return;
    const index = activeIndex as number;
    if (index === viewRef.current) return;
    scrollTo(index, true);
  }, [controlled, activeIndex, scrollTo]);

  // Auto-advance. The timer restarts on every slide change, so each slide gets
  // its own full interval.
  useEffect(() => {
    if (count <= 1) return;
    if (hovered || focused) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)")
      .matches;
    if (reduced) return;

    const id = window.setInterval(() => {
      // Never fight a swipe that is still in progress, and never burn a tick
      // while the tab is in the background.
      if (dragging.current) return;
      if (document.hidden) return;
      setActive((active + 1) % count);
    }, interval);

    return () => window.clearInterval(id);
  }, [active, count, focused, hovered, interval, setActive]);

  // Jump to a slide — used by the dots and by the strip.
  const goTo = useCallback(
    (index: number) => {
      if (controlled) {
        setActive(index);
      } else {
        setInternalActive(index);
        scrollTo(index, true);
      }
    },
    [controlled, scrollTo, setActive]
  );

  if (!count) return null;

  return (
    <section
      aria-label="Featured titles"
      className={cn(
        "relative w-full overflow-hidden bg-card-burgundy",
        className
      )}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocusCapture={() => setFocused(true)}
      onBlurCapture={() => setFocused(false)}
      onPointerDown={() => {
        dragging.current = true;
      }}
      onPointerUp={() => {
        dragging.current = false;
      }}
      onPointerCancel={() => {
        dragging.current = false;
      }}
    >
      <div
        ref={trackRef}
        className="no-scrollbar flex snap-x snap-mandatory overflow-x-auto scroll-smooth"
      >
        {slides.map((slide, i) => {
          const Title = (
            i === active ? headingLevel : "h2"
          ) as "h1" | "h2";
          return (
            <div
              key={`${slide.href}-${i}`}
              ref={(el) => {
                slideRefs.current[i] = el;
              }}
              data-index={i}
              aria-hidden={i !== active}
              className="relative h-[38vh] min-h-[240px] w-full shrink-0 snap-center sm:h-[44vh] sm:min-h-[300px] md:h-[50vh] md:min-h-[380px] lg:h-[56vh] lg:min-h-[430px]"
            >
              <Link
                href={slide.href}
                tabIndex={i === active ? 0 : -1}
                className="group absolute inset-0 block focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-4px] focus-visible:outline-brand"
              >
                {slide.imageUrl ? (
                  <Image
                    src={slide.imageUrl}
                    alt={slide.title}
                    fill
                    priority={i === 0}
                    sizes="100vw"
                    className="object-cover object-center transition-transform duration-700 group-hover:scale-[1.03]"
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

                {/* The app fades the bottom of the banner into the page so the
                    title stays readable over any artwork. */}
                <div className="absolute inset-0 bg-gradient-to-t from-bg-deepest/90 via-bg-deepest/25 to-transparent" />

                <div className="absolute inset-x-0 bottom-0 mx-auto max-w-7xl px-4 pb-7 md:px-6 md:pb-11 lg:px-8 lg:pb-13">
                  <Title className="font-display text-xl font-bold leading-[1.1] text-cream drop-shadow-[0_2px_10px_rgba(0,0,0,0.8)] sm:text-2xl md:text-4xl">
                    {slide.title}
                  </Title>
                  {slide.meta ? (
                    <p className="mt-1.5 text-[11px] font-medium tracking-wide text-cream/85 drop-shadow-[0_1px_4px_rgba(0,0,0,0.7)] sm:text-sm">
                      {slide.meta}
                    </p>
                  ) : null}
                </div>
              </Link>
            </div>
          );
        })}
      </div>

      {/* Slide dots — the app's pager position, and a way to jump to a slide
          with the keyboard. */}
      {count > 1 ? (
        <div className="absolute bottom-2 right-3 z-10 flex items-center gap-1.5 md:bottom-4 md:right-6">
          {slides.map((slide, i) => (
            <button
              key={`dot-${i}`}
              type="button"
              onClick={() => goTo(i)}
              aria-label={`Show ${slide.title}`}
              aria-current={i === active ? "true" : undefined}
              className={cn(
                "rounded-full transition-all duration-300",
                i === active
                  ? "h-1.5 w-6 bg-brand"
                  : "h-1.5 w-1.5 bg-cream/45 hover:bg-cream/80"
              )}
            />
          ))}
        </div>
      ) : null}
    </section>
  );
}
