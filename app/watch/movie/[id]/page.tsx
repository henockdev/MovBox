import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { WatchView } from "@/components/watch/WatchView";
import { WatchJsonLd } from "@/components/seo/WatchJsonLd";
import { getBoxmoviesDetailOutcome, getBoxmoviesRelated, titleFromDetailPath } from "@/lib/data";
import { DetailUnavailable } from "@/components/detail/DetailUnavailable";
import { toMediaCard } from "@/lib/adapters";
import { SITE_NAME, SITE_URL } from "@/lib/constants";
import { detailTitle, pageSeo } from "@/lib/seo";

export const revalidate = 3600;

interface WatchMoviePageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({
  params,
}: WatchMoviePageProps): Promise<Metadata> {
  const { id } = await params;
  const outcome = await getBoxmoviesDetailOutcome(id);

  if (outcome.kind === "missing") {
    return pageSeo({
      path: `/watch/movie/${encodeURIComponent(id)}`,
      title: "Watch",
      description: `Watch on ${SITE_NAME}.`,
      noindex: true,
    });
  }

  if (outcome.kind === "error") {
    // The catalogue refused the call. The title is in the URL, so the page
    // keeps its identity instead of answering "not found" for a movie that
    // exists.
    const title = titleFromDetailPath(id);
    return pageSeo({
      path: `/watch/movie/${encodeURIComponent(id)}`,
      title: detailTitle(`Watch ${title}`, "movie"),
      description: `Watch ${title} free on ${SITE_NAME} in HD. Full movies and new titles added daily — stream ${title} and thousands more online.`,
      image: "/opengraph-image",
      imageWidth: 1200,
      imageHeight: 630,
    });
  }

  const details = outcome.detail;

  // The raw synopsis — pageSeo() is what clamps it into the 120-160 band,
  // so clamping it here as well would append the description's tail twice.
  const description = details.synopsis || `Stream ${details.title} on ${SITE_NAME}.`;

  return pageSeo({
    path: `/watch/movie/${encodeURIComponent(details.detailPath)}`,
    title: detailTitle(`Watch ${details.title}`, "movie"),
    description,
    type: "video.movie",
    image: details.backdropUrl || details.posterUrl || "/opengraph-image",
    imageWidth: 1280,
    imageHeight: 720,
    keywords: [details.title, "watch online", "full movie", "free streaming"].filter(
      Boolean
    ),
  });
}

export default async function WatchMoviePage({ params }: WatchMoviePageProps) {
  const { id } = await params;
  const outcome = await getBoxmoviesDetailOutcome(id);

  if (outcome.kind === "missing") notFound();

  if (outcome.kind === "error") {
    return (
      <div className="bg-bg-deepest">
        <DetailUnavailable title={titleFromDetailPath(id)} kind="movie" />
      </div>
    );
  }

  const details = outcome.detail;

  // If boxmovies says this is actually a TV show, redirect to the TV route.
  if (details.kind === "tv") {
    redirect(`/watch/tv/${encodeURIComponent(details.detailPath)}/1/1`);
  }

  const year = details.releaseYear?.toString() ?? "";

  // Curated "Similar Movies" row at the bottom.
  const related = (await getBoxmoviesRelated(details.detailPath, "movie", 12).catch(() => [])).map(toMediaCard);

  const watchUrl = `${SITE_URL}/watch/movie/${encodeURIComponent(
    details.detailPath
  )}`;

  return (
    <div className="bg-bg-deepest">
      <header className="sticky top-0 z-30 flex items-center gap-2 border-b border-border bg-bg-deepest/90 px-3 py-2.5 backdrop-blur sm:px-5 sm:py-3 md:px-6">
        <Button asChild variant="ghost" size="icon" aria-label="Back">
          <Link href={`/movie/${encodeURIComponent(details.detailPath)}`}>
            <ArrowLeft className="h-4 w-4 sm:h-5 sm:w-5" />
          </Link>
        </Button>
        <div className="min-w-0 flex-1">
          <h1 className="line-clamp-1 font-display text-sm font-semibold text-cream sm:text-base md:text-lg">
            {details.title}
          </h1>
          <p className="text-[11px] text-text-muted sm:text-xs">
            {year}
            {details.durationLabel ? ` · ${details.durationLabel}` : ""}
          </p>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-0 pb-12 pt-0 sm:px-3 sm:pt-3 md:px-6 md:pt-6">
        <WatchJsonLd
          url={watchUrl}
          title={details.title}
          description={
            details.synopsis || `Watch ${details.title} on ${SITE_NAME}.`
          }
          thumbnail={details.backdropUrl ?? details.posterUrl}
          durationSeconds={details.durationSeconds}
          uploadDate={details.releaseDate}
          entity={{
            type: "Movie",
            name: details.title,
            url: `${SITE_URL}/movie/${encodeURIComponent(details.detailPath)}`,
            description: details.synopsis,
            image: details.backdropUrl ?? details.posterUrl,
            datePublished: details.releaseDate,
          }}
        />
        <WatchView
          type="movie"
          detailPath={details.detailPath}
          title={details.title}
          year={year}
          runtime={details.durationSeconds ? Math.round(details.durationSeconds / 60) : null}
          voteAverage={details.rating ?? 0}
          posterUrl={details.posterUrl}
          backdropUrl={details.backdropUrl}
          overview={details.synopsis}
          genres={(details.genres ?? []).map((g, i) => ({ id: i, name: g }))}
          country={details.country ?? null}
          releaseDate={details.releaseDate || ""}
          availableSubtitles={details.availableSubtitleLanguages}
          related={related}
          watchlistMedia={{
            id: details.detailPath,
            type: "movie",
            title: details.title,
            year: details.releaseDate,
            rating: details.rating ?? 0,
            posterPath: details.posterUrl,
            backdropPath: details.backdropUrl,
            overview: details.synopsis,
            runtime: details.durationSeconds ? Math.round(details.durationSeconds / 60) : null,
          }}
        />
      </div>
    </div>
  );
}
