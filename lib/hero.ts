import type { BoxHeroSlide, MediaCard } from "./types";
import { imageUrl } from "./image";

/**
 * The hero's data shapes.
 *
 * These live outside the client components so a Server Component can build
 * them: a function exported from a `"use client"` module cannot be *called*
 * from the server, only rendered.
 */

/** One slide of the 16:9 banner pager. */
export interface HeroBannerSlide {
  /** Where the slide links to. */
  href: string;
  title: string;
  /** The 16:9 banner artwork. */
  imageUrl: string | null;
  /** The line under the title, e.g. "2026 | Action". */
  meta?: string;
}

/**
 * Turn the upstream's banner slides into the two shapes the showcase renders:
 * the wide 16:9 artwork for the pager and the poster + meta for the strip.
 *
 * The strip shows the SAME slides as the banner, exactly like the app does —
 * the poster is the thumbnail, the subline is "year | genre".
 */
export function toHeroShowcase(slides: BoxHeroSlide[]): {
  slides: HeroBannerSlide[];
  items: MediaCard[];
} {
  return {
    slides: slides.map((s) => ({
      href: `/${s.type}/${encodeURIComponent(s.detailPath)}`,
      title: s.title,
      // The wide artwork is full-resolution in the catalogue (3840x2160,
      // ~1-2 MB); the CDN resizes it on the edge.
      imageUrl: imageUrl(s.bannerUrl, "w1280"),
      meta: [s.year, s.genre.replace(/,/g, ", ")]
        .filter(Boolean)
        .join(" | "),
    })),
    items: slides.map((s) => ({
      id: s.detailPath,
      type: s.type,
      title: s.title,
      year: s.year,
      rating: Number(s.rating) || 0,
      posterPath: s.posterUrl,
      backdropPath: s.bannerUrl,
      overview: "",
      subline: [s.year, s.genre.replace(/,/g, ", ")]
        .filter(Boolean)
        .join(" | "),
    })),
  };
}
