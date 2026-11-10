import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import {
  getBoxmoviesDetailOutcome,
  getBoxmoviesRelated,
  titleFromDetailPath,
} from "@/lib/data";
import { TVDetailView } from "@/components/detail/TVDetailView";
import { DetailUnavailable } from "@/components/detail/DetailUnavailable";
import { EpisodeIndex } from "@/components/watch/EpisodeIndex";
import { TVShowJsonLd } from "@/components/seo/MovieJsonLd";
import { SITE_NAME } from "@/lib/constants";
import {
  baseShowTitle,
  detailCanonical,
  detailTitle,
  pageSeo,
} from "@/lib/seo";

export const revalidate = 3600;

interface TVDetailPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({
  params,
}: TVDetailPageProps): Promise<Metadata> {
  const { id } = await params;
  const outcome = await getBoxmoviesDetailOutcome(id);

  if (outcome.kind === "missing") {
    return pageSeo({
      path: `/tv/${encodeURIComponent(id)}`,
      title: "TV show not found",
      description: `This TV show is not available on ${SITE_NAME}.`,
      noindex: true,
    });
  }

  if (outcome.kind === "error") {
    // A rate-limited catalogue call is not a missing show. The title is in
    // the URL, so the page keeps its identity.
    const show = titleFromDetailPath(id);
    return pageSeo({
      path: `/tv/${encodeURIComponent(id)}`,
      title: detailTitle(show, "tv"),
      description: `Watch ${show} free on ${SITE_NAME} in HD. Full episodes and seasons, new titles added daily — stream ${show} and thousands more online.`,
      image: "/opengraph-image",
      imageWidth: 1200,
      imageHeight: 630,
    });
  }

  const details = outcome.detail;

  // A movie requested under /tv/ is the wrong URL for it — see the
  // matching note in app/movie/[id]/page.tsx. The head is already flushed
  // by the time the body runs, so the correction is expressed as a
  // canonical + noindex pair and a client-side redirect.
  const isMovie = details.kind === "movie";
  const show = baseShowTitle(details.title);
  // The raw synopsis — pageSeo() is what clamps it into the 120-160 band.
  const description = details.synopsis || `Watch ${show} on ${SITE_NAME}.`;

  return pageSeo({
    path: `/tv/${encodeURIComponent(details.detailPath)}`,
    canonical: isMovie
      ? detailCanonical("movie", details.detailPath)
      : undefined,
    title: detailTitle(show, "tv"),
    description,
    type: isMovie ? "video.movie" : "video.tv_show",
    image: details.backdropUrl || details.posterUrl || "/opengraph-image",
    imageWidth: 1280,
    imageHeight: 720,
    keywords: [
      show,
      "watch online",
      "full episodes",
      "free streaming",
      ...(details.genres ?? []).slice(0, 5),
    ].filter(Boolean),
    noindex: isMovie,
  });
}

export default async function TVDetailPage({ params }: TVDetailPageProps) {
  const { id } = await params;
  const outcome = await getBoxmoviesDetailOutcome(id);

  if (outcome.kind === "missing") notFound();

  if (outcome.kind === "error") {
    return <DetailUnavailable title={titleFromDetailPath(id)} kind="tv" />;
  }

  const details = outcome.detail;

  // If boxmovies says this is actually a movie, redirect.
  if (details.kind === "movie") {
    redirect(`/movie/${encodeURIComponent(details.detailPath)}`);
  }

  // Curated "More Like This" — TV-biased, 12 items, no dupes, current excluded.
  const related = await getBoxmoviesRelated(details.detailPath, "tv", 12).catch(() => []);

  return (
    <>
      <TVShowJsonLd details={details} />
      <TVDetailView details={details} related={related} />

      {/* The episode index.
          The Ahrefs audit found 4 374 orphan pages — every one of them an
          episode watch page — because the episode picker is client-side, so
          the served HTML of a series page linked to exactly ONE episode
          (?s=1&e=1) out of dozens. This renders the full list as real
          server-side <a href> anchors, so every episode is linked from the
          series page as well as from its siblings. */}
      <div className="mx-auto max-w-7xl px-4 pb-16 md:px-6 lg:px-8">
        <EpisodeIndex
          detailPath={details.detailPath}
          showTitle={details.title}
          seasons={details.seasons}
        />
      </div>
    </>
  );
}
