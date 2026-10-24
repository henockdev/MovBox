import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getBoxmoviesDetail, getBoxmoviesRelated } from "@/lib/data";
import { MovieDetailView } from "@/components/detail/MovieDetailView";
import { SITE_NAME } from "@/lib/constants";
import { pageSeo } from "@/lib/seo";

export const revalidate = 3600;

interface MovieDetailPageProps {
  params: Promise<{ id: string }>;
}

/**
 * `/movies/<id>` is a legacy alias of `/movie/<id>`. Nothing links to it
 * any more, but it still renders the same content, so it would otherwise
 * compete with the canonical route for the same keywords. We cannot issue a
 * real HTTP redirect here (the document head is already flushed by the time
 * the page body runs), so the page canonicalises to the sibling route and
 * asks not to be indexed instead.
 */
export async function generateMetadata({
  params,
}: MovieDetailPageProps): Promise<Metadata> {
  const { id } = await params;
  const details = await getBoxmoviesDetail(id).catch(() => null);
  if (!details) {
    return pageSeo({
      path: `/movies/${encodeURIComponent(id)}`,
      title: "Movie not found",
      description: `This movie is not available on ${SITE_NAME}.`,
      noindex: true,
    });
  }

  return pageSeo({
    path: `/movies/${encodeURIComponent(details.detailPath)}`,
    canonical: `/movie/${encodeURIComponent(details.detailPath)}`,
    title: details.title,
    description:
      details.synopsis || `Watch ${details.title} on ${SITE_NAME}.`,
    type: "video.movie",
    image: details.backdropUrl ?? details.posterUrl,
    imageWidth: 1280,
    imageHeight: 720,
    noindex: true,
  });
}

export default async function MovieDetailPage({ params }: MovieDetailPageProps) {
  const { id } = await params;
  const details = await getBoxmoviesDetail(id).catch(() => null);
  if (!details) notFound();

  // If boxmovies says this is actually a TV show, redirect.
  if (details.kind === "tv") {
    redirect(`/tv/${encodeURIComponent(details.detailPath)}`);
  }

  // Curated "More Like This" — movie-biased, 12 items.
  const related = await getBoxmoviesRelated(details.detailPath, "movie", 12).catch(() => []);

  return (
    <>
      <MovieDetailView details={details} related={related} />
    </>
  );
}
