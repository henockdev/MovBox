import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import {
  getBoxmoviesDetailOutcome,
  getBoxmoviesRelated,
  titleFromDetailPath,
} from "@/lib/data";
import { MovieDetailView } from "@/components/detail/MovieDetailView";
import { DetailUnavailable } from "@/components/detail/DetailUnavailable";
import { SITE_NAME } from "@/lib/constants";
import { MovieJsonLd } from "@/components/seo/MovieJsonLd";
import { detailCanonical, detailTitle, pageSeo } from "@/lib/seo";

export const revalidate = 3600;

interface MovieDetailPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({
  params,
}: MovieDetailPageProps): Promise<Metadata> {
  const { id } = await params;
  const outcome = await getBoxmoviesDetailOutcome(id);

  if (outcome.kind === "missing") {
    return pageSeo({
      path: `/movie/${encodeURIComponent(id)}`,
      title: "Movie not found",
      description: `This movie is not available on ${SITE_NAME}.`,
      noindex: true,
    });
  }

  if (outcome.kind === "error") {
    // The catalogue refused the call — usually a rate limit. The title is
    // still known (it is in the URL), so the page keeps its identity
    // instead of claiming the movie does not exist.
    const title = titleFromDetailPath(id);
    return pageSeo({
      path: `/movie/${encodeURIComponent(id)}`,
      title: detailTitle(title, "movie"),
      description: `Watch ${title} free on ${SITE_NAME} in HD. Full movies and new titles added daily — stream ${title} and thousands more online.`,
      image: "/opengraph-image",
      imageWidth: 1200,
      imageHeight: 630,
    });
  }

  const details = outcome.detail;
  // A TV show requested under /movie/ is the wrong URL for it. We cannot
  // issue a real HTTP redirect from here: the document head is already
  // flushed by the time the page body runs, so Next.js can only perform a
  // client-side redirect. Instead the page canonicalises to the sibling
  // route and asks not to be indexed, so the two URLs never compete for
  // the same keywords.
  const isTv = details.kind === "tv";
  // The raw synopsis — pageSeo() is what clamps it into the 120-160 band,
  // so clamping it here as well would append the description's tail twice.
  const description = details.synopsis || `Watch ${details.title} on ${SITE_NAME}.`;

  return pageSeo({
    path: `/movie/${encodeURIComponent(details.detailPath)}`,
    canonical: isTv
      ? detailCanonical("tv", details.detailPath)
      : undefined,
    title: detailTitle(details.title, "movie"),
    description,
    type: isTv ? "video.tv_show" : "video.movie",
    image: details.backdropUrl || details.posterUrl || "/opengraph-image",
    imageWidth: 1280,
    imageHeight: 720,
    keywords: [
      details.title,
      "watch online",
      "free streaming",
      ...(details.genres ?? []).slice(0, 5),
    ].filter(Boolean),
    noindex: isTv,
  });
}

export default async function MovieDetailPage({ params }: MovieDetailPageProps) {
  const { id } = await params;
  const outcome = await getBoxmoviesDetailOutcome(id);

  if (outcome.kind === "missing") notFound();

  if (outcome.kind === "error") {
    return <DetailUnavailable title={titleFromDetailPath(id)} kind="movie" />;
  }

  const details = outcome.detail;

  // If boxmovies says this is actually a TV show, redirect.
  if (details.kind === "tv") {
    redirect(`/tv/${encodeURIComponent(details.detailPath)}`);
  }

  // Curated "More Like This" — movie-biased, 12 items.
  const related = await getBoxmoviesRelated(details.detailPath, "movie", 12).catch(() => []);

  return (
    <>
      <MovieJsonLd details={details} />
      <MovieDetailView details={details} related={related} />
    </>
  );
}
