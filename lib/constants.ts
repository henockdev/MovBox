/**
 * Static site-wide constants.
 * Genres, rating sources, quality labels, etc.
 */

import type { LucideIcon } from "lucide-react";
import {
  Sword,
  Compass,
  Rocket,
  Drama,
  Ghost,
  Heart,
  Smile,
  Sparkles,
  Baby,
  Film,
} from "lucide-react";

/** TMDB movie genre IDs (stable, from TMDB API docs) */
export const MOVIE_GENRES = {
  Action: 28,
  Adventure: 12,
  Animation: 16,
  Comedy: 35,
  Crime: 80,
  Documentary: 99,
  Drama: 18,
  Family: 10751,
  Fantasy: 14,
  History: 36,
  Horror: 27,
  Music: 10402,
  Mystery: 9648,
  Romance: 10749,
  ScienceFiction: 878,
  TVMovie: 10770,
  Thriller: 53,
  War: 10752,
  Western: 37,
} as const;

/** Genre chips for the home page horizontal nav (matches design) */
export const GENRE_NAV: Array<{
  name: string;
  tmdbId: number;
  icon: LucideIcon;
}> = [
  { name: "Action", tmdbId: MOVIE_GENRES.Action, icon: Sword },
  { name: "Adventure", tmdbId: MOVIE_GENRES.Adventure, icon: Compass },
  { name: "Sci-Fi", tmdbId: MOVIE_GENRES.ScienceFiction, icon: Rocket },
  { name: "Drama", tmdbId: MOVIE_GENRES.Drama, icon: Drama },
  { name: "Thriller", tmdbId: MOVIE_GENRES.Thriller, icon: Ghost },
  { name: "Horror", tmdbId: MOVIE_GENRES.Horror, icon: Ghost },
  { name: "Comedy", tmdbId: MOVIE_GENRES.Comedy, icon: Smile },
  { name: "Romance", tmdbId: MOVIE_GENRES.Romance, icon: Heart },
  { name: "Anime", tmdbId: MOVIE_GENRES.Animation, icon: Sparkles },
  { name: "Documentary", tmdbId: MOVIE_GENRES.Documentary, icon: Film },
];

/** Quality ladder shown in the player quality menu */
export const QUALITY_LEVELS: ReadonlyArray<{
  label: string;
  value: string;
  recommended?: boolean;
  premium?: boolean;
}> = [
  { label: "Auto", value: "auto", recommended: true },
  { label: "2160p 4K", value: "2160", premium: true },
  { label: "1080p HD", value: "1080" },
  { label: "720p HD", value: "720" },
  { label: "480p", value: "480" },
  { label: "360p", value: "360" },
  { label: "240p", value: "240" },
];

/** Common certifications */
export const CERTIFICATIONS = [
  "G",
  "PG",
  "PG-13",
  "R",
  "NC-17",
  "TV-Y",
  "TV-Y7",
  "TV-G",
  "TV-PG",
  "TV-14",
  "TV-MA",
] as const;

/** Site name used everywhere */
export const SITE_NAME = "Movbox";

/**
 * Public site URL. Set NEXT_PUBLIC_SITE_URL in env to override the
 * default. We only accept valid http(s) URLs — a stray "y" or empty
 * value falls back to the canonical movbox.xyz instead of breaking
 * the build (e.g. with `new URL("y")` in Next.js's metadataBase).
 */
export const SITE_URL = (() => {
  const raw = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (raw && /^https?:\/\//i.test(raw)) return raw.replace(/\/+$/, "");
  return "https://movbox.xyz";
})();

/** Default locale */
export const DEFAULT_LOCALE = "en-US";
