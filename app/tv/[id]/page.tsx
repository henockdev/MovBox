import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getBoxmoviesDetail, getBoxmoviesRelated } from "@/lib/data";
import { TVDetailView } from "@/components/detail/TVDetailView";
import { TVShowJsonLd } from "@/components/seo/MovieJsonLd";
import { SITE_NAME, SITE_URL } from "@/lib/constants";

export const revalidate = 3600;

interface TVDetailPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({
  params,
}: TVDetailPageProps): Promise<Metadata> {
  const { id } = await params;
  const details = await getBoxmoviesDetail(id).catch(() => null);
  if (!details) return { title: "TV Show" };
  return {
    title: details.title,
    description: details.synopsis || `Watch ${details.title} on ${SITE_NAME}.`,
    openGraph: {
      title: details.title,
      description: details.synopsis || `Watch ${details.title} on ${SITE_NAME}.`,
      url: `${SITE_URL}/tv/${encodeURIComponent(id)}`,
      siteName: SITE_NAME,
      type: "video.tv_show",
      images: details.backdropUrl
        ? [{ url: details.backdropUrl, width: 1280, height: 720, alt: details.title }]
        : undefined,
    },
  };
}

export default async function TVDetailPage({ params }: TVDetailPageProps) {
  const { id } = await params;
  const details = await getBoxmoviesDetail(id).catch(() => null);
  if (!details) notFound();

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
    </>
  );
}
