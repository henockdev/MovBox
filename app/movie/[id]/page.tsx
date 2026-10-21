import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getBoxmoviesDetail, getBoxmoviesRelated } from "@/lib/data";
import { MovieDetailView } from "@/components/detail/MovieDetailView";
import { SITE_NAME, SITE_URL } from "@/lib/constants";
import { MovieJsonLd } from "@/components/seo/MovieJsonLd";

export const revalidate = 3600;

interface MovieDetailPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({
  params,
}: MovieDetailPageProps): Promise<Metadata> {
  const { id } = await params;
  const details = await getBoxmoviesDetail(id).catch(() => null);
  if (!details) return { title: "Movie" };
  return {
    title: details.title,
    description: details.synopsis || `Watch ${details.title} on ${SITE_NAME}.`,
    openGraph: {
      title: details.title,
      description: details.synopsis || `Watch ${details.title} on ${SITE_NAME}.`,
      url: `${SITE_URL}/movie/${encodeURIComponent(id)}`,
      siteName: SITE_NAME,
      type: "video.movie",
      images: details.backdropUrl
        ? [{ url: details.backdropUrl, width: 1280, height: 720, alt: details.title }]
        : undefined,
    },
  };
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
