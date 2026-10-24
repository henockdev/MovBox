import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getBoxmoviesDetail, getBoxmoviesRelated } from "@/lib/data";
import { MovieDetailView } from "@/components/detail/MovieDetailView";
import { SITE_NAME } from "@/lib/constants";
import { MovieJsonLd } from "@/components/seo/MovieJsonLd";
import { detailCanonical, pageSeo } from "@/lib/seo";

export const revalidate = 3600;

interface MovieDetailPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({
  params,
}: MovieDetailPageProps): Promise<Metadata> {
  const { id } = await params;
  const details = await getBoxmoviesDetail(id).catch(() => null);
  if (!details) {
    return pageSeo({
      path: `/movie/${encodeURIComponent(id)}`,
      title: "Movie not found",
      description: `This movie is not available on ${SITE_NAME}.`,
      noindex: true,
    });
  }

  // A TV show requested under /movie/ is the wrong URL for it. We cannot
  // issue a real HTTP redirect from here: the document head is already
  // flushed by the time the page body runs, so Next.js can only perform a
  // client-side redirect. Instead the page canonicalises to the sibling
  // route and asks not to be indexed, so the two URLs never compete for
  // the same keywords.
  const isTv = details.kind === "tv";
  const description =
    details.synopsis || `Watch ${details.title} on ${SITE_NAME}.`;

  return pageSeo({
    path: `/movie/${encodeURIComponent(details.detailPath)}`,
    canonical: isTv
      ? detailCanonical("tv", details.detailPath)
      : undefined,
    title: details.title,
    description,
    type: isTv ? "video.tv_show" : "video.movie",
    image: details.backdropUrl ?? details.posterUrl,
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
      <MovieJsonLd details={details} />
      <MovieDetailView details={details} related={related} />
    </>
  );
}
