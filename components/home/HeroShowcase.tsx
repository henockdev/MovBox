"use client";

import { useState } from "react";
import { HeroBanner } from "./HeroBanner";
import { HeroSlideStrip } from "./HeroSlideStrip";
import type { HeroBannerSlide } from "@/lib/hero";
import type { MediaCard } from "@/lib/types";

/**
 * The hero and the strip under it, as one unit.
 *
 * In the app these are not two components — they share one carousel state.
 * The banner advances on its own, the strip highlights the live slide, and
 * tapping a strip card moves the banner. Splitting them into two islands on
 * the web is what made the strip feel like a dead row of thumbnails instead
 * of the pager control it is on a phone.
 *
 * The island is deliberately small: one piece of state (which slide is live)
 * and two children. Everything else stays on the server.
 */
export function HeroShowcase({
  slides,
  items,
  headingLevel = "h1",
  className,
}: {
  slides: HeroBannerSlide[];
  items: MediaCard[];
  headingLevel?: "h1" | "h2";
  className?: string;
}) {
  const [active, setActive] = useState(0);

  if (!slides.length) return null;

  return (
    <div className={className}>
      <HeroBanner
        slides={slides}
        headingLevel={headingLevel}
        activeIndex={active}
        onActiveChange={setActive}
      />
      <div className="pt-3 sm:pt-4">
        <HeroSlideStrip
          items={items}
          activeIndex={active}
          onSelect={setActive}
        />
      </div>
    </div>
  );
}
