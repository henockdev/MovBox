import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { WatchView } from "@/components/watch/WatchView";
import { getBoxmoviesDetail, getBoxmoviesRelated } from "@/lib/data";
import { toMediaCard } from "@/lib/adapters";
import { SITE_NAME } from "@/lib/constants";

export const revalidate = 3600;

interface WatchMoviePageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({
  params,
}: WatchMoviePageProps): Promise<Metadata> {
  const { id } = await params;
  const details = await getBoxmoviesDetail(id).catch(() => null);
  if (!details) return { title: "Watch" };
  return {
    title: `Watch ${details.title}`,
    description: details.synopsis || `Stream ${details.title} on ${SITE_NAME}.`,
  };
}

export default async function WatchMoviePage({ params }: WatchMoviePageProps) {
  const { id } = await params;
  const details = await getBoxmoviesDetail(id).catch(() => null);
  if (!details) notFound();

  // If boxmovies says this is actually a TV show, redirect to the TV route.
  if (details.kind === "tv") {
    redirect(`/watch/tv/${encodeURIComponent(details.detailPath)}/1/1`);
  }

  const year = details.releaseYear?.toString() ?? "";

  // Curated "Similar Movies" row at the bottom.
  const related = (await getBoxmoviesRelated(details.detailPath, "movie", 12).catch(() => [])).map(toMediaCard);

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
