import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getBoxmoviesDetail, getBoxmoviesRelated } from "@/lib/data";
import { TVDetailView } from "@/components/detail/TVDetailView";
import { TVShowJsonLd } from "@/components/seo/MovieJsonLd";
import { SITE_NAME } from "@/lib/constants";
import { baseShowTitle, detailCanonical, pageSeo } from "@/lib/seo";

export const revalidate = 3600;

interface TVDetailPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({
  params,
}: TVDetailPageProps): Promise<Metadata> {
  const { id } = await params;
  const details = await getBoxmoviesDetail(id).catch(() => null);
  if (!details) {
    return pageSeo({
      path: `/tv/${encodeURIComponent(id)}`,
      title: "TV show not found",
      description: `This TV show is not available on ${SITE_NAME}.`,
      noindex: true,
    });
  }

  // A movie requested under /tv/ is the wrong URL for it — see the
  // matching note in app/movie/[id]/page.tsx. The head is already flushed
  // by the time the body runs, so the correction is expressed as a
  // canonical + noindex pair and a client-side redirect.
  const isMovie = details.kind === "movie";
  const show = baseShowTitle(details.title);
  const description =
    details.synopsis || `Watch ${show} on ${SITE_NAME}.`;

  return pageSeo({
    path: `/tv/${encodeURIComponent(details.detailPath)}`,
    canonical: isMovie
      ? detailCanonical("movie", details.detailPath)
      : undefined,
    title: show,
    description,
    type: isMovie ? "video.movie" : "video.tv_show",
    image: details.backdropUrl ?? details.posterUrl,
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
