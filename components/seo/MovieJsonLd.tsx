import { SITE_NAME, SITE_URL } from "@/lib/constants";
import type { BoxDetail } from "@/lib/types";

/**
 * JSON-LD structured data for a movie. Google uses this to render
 * rich results (poster thumbnail, rating, year, director, video
 * player) directly in the search result. Critical for "watch
 * {title} online" type queries to surface the Movbox page as a
 * rich card + a video result in the Videos tab.
 *
 * We emit 3 connected schemas in one @graph:
 *   - Movie: the main entity
 *   - VideoObject: nested so Google indexes the playable video
 *   - BreadcrumbList: shows breadcrumb in the search snippet
 *
 * Schema reference:
 *   https://schema.org/Movie
 *   https://schema.org/VideoObject
 *   https://schema.org/BreadcrumbList
 */

interface JsonLdProps {
  details: BoxDetail;
}

function cleanGenres(genres?: { id: number; name: string }[] | string[] | null) {
  if (!Array.isArray(genres)) return undefined;
  const out = genres
    .map((g) => (typeof g === "string" ? g : g?.name))
    .filter(Boolean) as string[];
  return out.length ? out : undefined;
}

export function MovieJsonLd({ details }: JsonLdProps) {
  const pageUrl = `${SITE_URL}/movie/${encodeURIComponent(details.detailPath)}`;
  const thumbnail = details.backdropUrl ?? details.posterUrl;
  const rating =
    typeof details.rating === "number" && details.rating > 0
      ? {
          "@type": "AggregateRating",
          ratingValue: details.rating,
          bestRating: 10,
          ...(details.ratingCount ? { ratingCount: details.ratingCount } : {}),
        }
      : undefined;

  const director = details.cast
    .filter((c) => /director/i.test(c.character || ""))
    .map((c) => ({ "@type": "Person", name: c.name }));
  const actor = details.cast.slice(0, 10).map((c) => ({
    "@type": "Person",
    name: c.name,
  }));

  const movie = {
    "@type": "Movie",
    "@id": `${pageUrl}#movie`,
    name: details.title,
    url: pageUrl,
    description: details.synopsis,
    // Image gallery — Google uses multiple images for the
    // "image carousel" rich result on mobile. Backdrop is the
    // primary, poster is the secondary, and we add the page's
    // own OG image as a guaranteed third.
    image: [
      details.backdropUrl,
      details.posterUrl,
      `${SITE_URL}/opengraph-image`,
    ].filter(Boolean),
    datePublished: details.releaseDate || undefined,
    director: director.length ? director : undefined,
    actor: actor.length ? actor : undefined,
    genre: cleanGenres(details.genres),
    duration: details.durationSeconds
      ? `PT${Math.floor(details.durationSeconds / 60)}M`
      : undefined,
    aggregateRating: rating,
    inLanguage: "en",
    isAccessibleForFree: true,
    provider: { "@type": "Organization", name: SITE_NAME, url: SITE_URL },
  };

  // VideoObject — what powers the Google Videos tab + video
  // carousel. Must include thumbnail, name, description, uploadDate,
  // and a contentUrl or embedUrl. We use the page URL as embedUrl
  // (Google will discover the actual stream via the iframe).
  const video = {
    "@type": "VideoObject",
    "@id": `${pageUrl}#video`,
    name: details.title,
    description: details.synopsis,
    thumbnailUrl: thumbnail ? [thumbnail] : undefined,
    uploadDate: details.releaseDate || undefined,
    embedUrl: pageUrl,
    contentUrl: pageUrl,
    isFamilyFriendly: true,
    inLanguage: "en",
    duration: details.durationSeconds
      ? `PT${Math.floor(details.durationSeconds / 60)}M`
      : undefined,
    partOfSeries: undefined,
    // Tells Google the video is available without a subscription
    // and is a free, ad-supported stream.
    publication: {
      "@type": "BroadcastEvent",
      isLive: false,
      name: details.title,
    },
  };

  const breadcrumbs = {
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Home",
        item: SITE_URL,
      },
      {
        "@type": "ListItem",
        position: 2,
        name: "Movies",
        item: `${SITE_URL}/movies`,
      },
      {
        "@type": "ListItem",
        position: 3,
        name: details.title,
        item: pageUrl,
      },
    ],
  };

  const json = {
    "@context": "https://schema.org",
    "@graph": [movie, video, breadcrumbs].map((node) =>
      Object.fromEntries(Object.entries(node).filter(([, v]) => v !== undefined)),
    ),
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(json) }}
    />
  );
}

/**
 * JSON-LD for a TV series. Same structure as the movie variant
 * but uses TVSeries + has partOfSeries for episodes.
 */
export function TVShowJsonLd({ details }: JsonLdProps) {
  const pageUrl = `${SITE_URL}/tv/${encodeURIComponent(details.detailPath)}`;
  const thumbnail = details.backdropUrl ?? details.posterUrl;
  const rating =
    typeof details.rating === "number" && details.rating > 0
      ? {
          "@type": "AggregateRating",
          ratingValue: details.rating,
          bestRating: 10,
          ...(details.ratingCount ? { ratingCount: details.ratingCount } : {}),
        }
      : undefined;

  const director = details.cast
    .filter((c) => /director/i.test(c.character || ""))
    .map((c) => ({ "@type": "Person", name: c.name }));
  const actor = details.cast.slice(0, 10).map((c) => ({
    "@type": "Person",
    name: c.name,
  }));

  const totalEpisodes = details.seasons.reduce(
    (acc, s) => acc + (s.episodes?.length ?? s.episodeCount ?? 0),
    0,
  );

  const tv = {
    "@type": "TVSeries",
    "@id": `${pageUrl}#tv`,
    name: details.title,
    url: pageUrl,
    description: details.synopsis,
    image: [
      details.backdropUrl,
      details.posterUrl,
      `${SITE_URL}/opengraph-image`,
    ].filter(Boolean),
    datePublished: details.releaseDate || undefined,
    director: director.length ? director : undefined,
    actor: actor.length ? actor : undefined,
    genre: cleanGenres(details.genres),
    numberOfSeasons: details.seasons.length || undefined,
    numberOfEpisodes: totalEpisodes || undefined,
    aggregateRating: rating,
    inLanguage: "en",
    isAccessibleForFree: true,
    provider: { "@type": "Organization", name: SITE_NAME, url: SITE_URL },
  };

  const video = {
    "@type": "VideoObject",
    "@id": `${pageUrl}#video`,
    name: details.title,
    description: details.synopsis,
    thumbnailUrl: thumbnail ? [thumbnail] : undefined,
    uploadDate: details.releaseDate || undefined,
    embedUrl: pageUrl,
    contentUrl: pageUrl,
    isFamilyFriendly: true,
    inLanguage: "en",
  };

  const breadcrumbs = {
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
      { "@type": "ListItem", position: 2, name: "TV Shows", item: `${SITE_URL}/tv` },
      { "@type": "ListItem", position: 3, name: details.title, item: pageUrl },
    ],
  };

  const json = {
    "@context": "https://schema.org",
    "@graph": [tv, video, breadcrumbs].map((node) =>
      Object.fromEntries(Object.entries(node).filter(([, v]) => v !== undefined)),
    ),
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(json) }}
    />
  );
}
