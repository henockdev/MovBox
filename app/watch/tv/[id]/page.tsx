import type { Metadata } from "next";
import { Suspense } from "react";
import WatchTVClient from "@/components/watch/WatchTVClient";
import { WatchJsonLd } from "@/components/seo/WatchJsonLd";
import { EpisodeIndex } from "@/components/watch/EpisodeIndex";
import { getBoxmoviesDetailOutcome, titleFromDetailPath } from "@/lib/data";
import { DetailUnavailable } from "@/components/detail/DetailUnavailable";
import { SITE_NAME, SITE_URL } from "@/lib/constants";
import {
  baseShowTitle,
  clampEpisodeNumber,
  pageSeo,
} from "@/lib/seo";

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
  const outcome = await getBoxmoviesDetailOutcome(id);

  if (outcome.kind === "missing") {
    return pageSeo({
      path: `/watch/tv/${encodeURIComponent(id)}`,
      title: "Watch",
      description: `Watch on ${SITE_NAME}.`,
      noindex: true,
    });
  }

  if (outcome.kind === "error") {
    // The catalogue refused the call — the show is still in the URL.
    const show = titleFromDetailPath(id);
    return pageSeo({
      path: `/watch/tv/${encodeURIComponent(id)}?s=${season}&e=${episode}`,
      title: detailTitle(`Watch ${show}`, "tv"),
      description: `Watch ${show} season ${season} episode ${episode} free on ${SITE_NAME} in HD. Full episodes and seasons, new titles added daily — stream ${show} and thousands more online.`,
      image: "/opengraph-image",
      imageWidth: 1200,
      imageHeight: 630,
    });
  }

  const details = outcome.detail;

  const show = baseShowTitle(details.title);
  const path = `/watch/tv/${encodeURIComponent(
    details.detailPath
  )}?s=${season}&e=${episode}`;

  // The prefix eats most of the 160-character budget, so the synopsis is
  // clamped to whatever room is left — on a word boundary, never mid-word.
  // The prefix plus the raw synopsis. pageSeo() is what clamps the pair
  // into the 120-160 band — clamping it here as well would append the
  // description's tail twice.
  const prefix = `Watch ${show} season ${season} episode ${episode} free on ${SITE_NAME}.`;
  const synopsis = (details.synopsis || "").trim();
  const description = synopsis ? `${prefix} ${synopsis}` : prefix;

  return pageSeo({
    path,
    title: `Watch ${show} Season ${season} Episode ${episode}`,
    description,
    type: "video.episode",
    image: details.backdropUrl || details.posterUrl || "/opengraph-image",
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
  const outcome = await getBoxmoviesDetailOutcome(id);

  if (outcome.kind === "missing") notFound();

  if (outcome.kind === "error") {
    return (
      <div className="bg-bg-deepest">
        <DetailUnavailable title={titleFromDetailPath(id)} kind="tv" />
      </div>
    );
  }

  const details = outcome.detail;

  const show = baseShowTitle(details.title);
  const url = `${SITE_URL}/watch/tv/${encodeURIComponent(
    details.detailPath
  )}?s=${season}&e=${episode}`;

  return (
    <>
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
      {/* The player reads the episode from the query string with
          useSearchParams(), which Next.js only allows inside a Suspense
          boundary. */}
      <Suspense
        fallback={
          <div className="mx-auto max-w-7xl px-4 py-10 md:px-6 lg:px-8">
            <div className="skeleton aspect-video w-full rounded-xl" />
          </div>
        }
      >
        <WatchTVClient />
      </Suspense>

      {/* The episode index.
          The Ahrefs audit found 4 374 orphan pages — every one of them an
          episode watch page — because the episode picker is client-side and
          the served HTML linked to no episode at all. This renders the same
          list as real server-side <a href> anchors, so every episode is
          linked from its siblings and the crawl graph is connected. */}
      {details ? (
        <div className="mx-auto max-w-7xl px-4 pb-16 md:px-6 lg:px-8">
          <EpisodeIndex
            detailPath={details.detailPath}
            showTitle={details.title}
            seasons={details.seasons}
          />
        </div>
      ) : null}
    </>
  );
}
