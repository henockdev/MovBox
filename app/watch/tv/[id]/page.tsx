import type { Metadata } from "next";
import WatchTVClient from "@/components/watch/WatchTVClient";
import { WatchJsonLd } from "@/components/seo/WatchJsonLd";
import { getBoxmoviesDetail } from "@/lib/data";
import { SITE_NAME, SITE_URL } from "@/lib/constants";
import { baseShowTitle, clampEpisodeNumber, pageSeo } from "@/lib/seo";

export const revalidate = 3600;

/**
 * Server half of the TV watch route.
 *
 * The player itself lives in components/watch/WatchTVClient.tsx (a
 * client component) so switching episodes never unmounts it. This file
 * exists so the route can emit per-episode metadata in the SERVED HTML:
 * title, description, canonical and JSON-LD.
 *
 * Before the split this route was a pure client component, so every
 * episode of every show answered crawlers with the identical site-wide
 * default title and no canonical — the whole episode catalogue looked
 * like one duplicated page.
 *
 * The episode is expressed as `?s=<season>&e=<episode>` — the URL shape
 * the site already used. Nothing about the address scheme changed, so
 * no existing link or ranking moves.
 */

interface WatchTVPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

async function readEpisode(
  searchParams: WatchTVPageProps["searchParams"]
): Promise<{ season: number; episode: number }> {
  const sp = (await searchParams.catch(
    () => ({}) as Record<string, string | string[] | undefined>
  )) || ({} as Record<string, string | string[] | undefined>);
  return {
    season: clampEpisodeNumber(sp.s, 1, 1, 99),
    episode: clampEpisodeNumber(sp.e, 1, 1, 9999),
  };
}

export async function generateMetadata({
  params,
  searchParams,
}: WatchTVPageProps): Promise<Metadata> {
  const { id } = await params;
  const { season, episode } = await readEpisode(searchParams);
  const details = await getBoxmoviesDetail(id).catch(() => null);
  if (!details) {
    return pageSeo({
      path: `/watch/tv/${encodeURIComponent(id)}`,
      title: "Watch",
      description: `Watch on ${SITE_NAME}.`,
      noindex: true,
    });
  }

  const show = baseShowTitle(details.title);
  const path = `/watch/tv/${encodeURIComponent(
    details.detailPath
  )}?s=${season}&e=${episode}`;

  const synopsis = (details.synopsis || "").trim();
  const description = `Watch ${show} season ${season} episode ${episode} free on ${SITE_NAME}.${
    synopsis ? ` ${synopsis.slice(0, 160)}` : ""
  }`.trim();

  return pageSeo({
    path,
    title: `Watch ${show} Season ${season} Episode ${episode}`,
    description,
    type: "video.episode",
    image: details.backdropUrl ?? details.posterUrl,
    imageWidth: 1280,
    imageHeight: 720,
    keywords: [show, "full episode", "watch online", "free streaming"].filter(
      Boolean
    ),
  });
}

export default async function WatchTVPage({
  params,
  searchParams,
}: WatchTVPageProps) {
  const { id } = await params;
  const { season, episode } = await readEpisode(searchParams);
  const details = await getBoxmoviesDetail(id).catch(() => null);

  const show = baseShowTitle(details?.title ?? "");
  const url = `${SITE_URL}/watch/tv/${encodeURIComponent(
    details?.detailPath ?? id
  )}?s=${season}&e=${episode}`;

  return (
    <>
      {details ? (
        <WatchJsonLd
          url={url}
          title={`${show} Season ${season} Episode ${episode}`}
          description={
            details.synopsis ||
            `Watch ${show} season ${season} episode ${episode} free on ${SITE_NAME}.`
          }
          thumbnail={details.backdropUrl ?? details.posterUrl}
          durationSeconds={details.durationSeconds}
          uploadDate={details.releaseDate}
          entity={{
            type: "TVSeries",
            name: show,
            url: `${SITE_URL}/tv/${encodeURIComponent(details.detailPath)}`,
            description: details.synopsis,
            image: details.backdropUrl ?? details.posterUrl,
            datePublished: details.releaseDate,
          }}
          season={season}
          episode={episode}
        />
      ) : null}
      <WatchTVClient />
    </>
  );
}
