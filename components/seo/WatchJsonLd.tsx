import { SITE_URL } from "@/lib/constants";

/**
 * JSON-LD for the watch pages — the pages where the video actually plays.
 *
 * The detail pages (/movie/<id>, /tv/<id>) carry the Movie / TVSeries
 * entity. These pages carry the VideoObject, because that is where the
 * player lives. Google requires `embedUrl` to point at the page that
 * embeds the video, so pointing it at the detail page (as we used to)
 * was factually wrong and suppressed the video rich result.
 *
 * For TV we additionally emit a TVEpisode + TVSeries pair, which is the
 * structure Google documents for episodic content and the one that makes
 * "watch <show> season 1 episode 3" queries eligible for a rich result.
 */

interface WatchJsonLdProps {
  /** Canonical URL of THIS watch page (absolute). */
  url: string;
  /** Episode/movie title used for the video node. */
  title: string;
  description: string;
  thumbnail?: string | null;
  durationSeconds?: number | null;
  /** ISO date the content was published, if known. */
  uploadDate?: string | null;
  /**
   * The parent entity this video belongs to. For a movie it is the Movie
   * itself; for an episode it is the TVSeries the episode belongs to.
   * Emitting it on the watch page lets Google connect the video to the
   * right catalogue entity.
   */
  entity?: {
    type: "Movie" | "TVSeries";
    name: string;
    url: string;
    description?: string | null;
    image?: string | null;
    datePublished?: string | null;
  };
  season?: number;
  episode?: number;
}

function isoDuration(seconds?: number | null): string | undefined {
  if (!seconds || !Number.isFinite(seconds) || seconds <= 0) return undefined;
  const total = Math.round(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `PT${h ? `${h}H` : ""}${m ? `${m}M` : ""}${s ? `${s}S` : ""}`;
}

function isoDate(value?: string | null): string | undefined {
  if (!value) return undefined;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return undefined;
  return d.toISOString().slice(0, 10);
}

export function WatchJsonLd({
  url,
  title,
  description,
  thumbnail,
  durationSeconds,
  uploadDate,
  entity,
  season,
  episode,
}: WatchJsonLdProps) {
  const image = thumbnail || undefined;
  const duration = isoDuration(durationSeconds);
  const date = isoDate(uploadDate);

  const isEpisode =
    typeof season === "number" &&
    typeof episode === "number" &&
    entity?.type === "TVSeries";

  const video = {
    "@type": "VideoObject",
    "@id": `${url}#video`,
    name: title,
    description,
    thumbnailUrl: image ? [image] : undefined,
    uploadDate: date,
    embedUrl: url,
    isFamilyFriendly: true,
    inLanguage: "en",
    duration,
    ...(isEpisode
      ? {
          partOfSeries: { "@id": `${entity.url}#tv` },
          episodeNumber: episode,
        }
      : {}),
  };

  const nodes: Record<string, unknown>[] = [];

  if (isEpisode) {
    nodes.push({
      "@type": "TVEpisode",
      "@id": `${url}#episode`,
      name: title,
      description,
      url,
      episodeNumber: episode,
      seasonNumber: season,
      ...(image ? { image } : {}),
      ...(date ? { datePublished: date } : {}),
      partOfSeries: { "@id": `${entity.url}#tv` },
    });
  }

  if (entity) {
    const entityDate = isoDate(entity.datePublished);
    nodes.push({
      "@type": entity.type,
      "@id": `${entity.url}#${entity.type === "Movie" ? "movie" : "tv"}`,
      name: entity.name,
      url: entity.url,
      ...(entity.description ? { description: entity.description } : {}),
      ...(entity.image ? { image: entity.image } : {}),
      ...(entityDate ? { datePublished: entityDate } : {}),
    });
  }

  nodes.push(video);

  nodes.push({
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
      ...(isEpisode
        ? [
            {
              "@type": "ListItem",
              position: 2,
              name: entity.name,
              item: entity.url,
            },
          ]
        : [
            {
              "@type": "ListItem",
              position: 2,
              name: "Movies",
              item: `${SITE_URL}/movies`,
            },
          ]),
      { "@type": "ListItem", position: 3, name: title, item: url },
    ],
  });

  const json = {
    "@context": "https://schema.org",
    "@graph": nodes.map((node) =>
      Object.fromEntries(Object.entries(node).filter(([, v]) => v !== undefined))
    ),
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(json) }}
    />
  );
}
