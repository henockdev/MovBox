import { notFound, redirect } from "next/navigation";
import { getBoxmoviesDetail, getBoxmoviesRelated } from "@/lib/data";
import { toMediaCard } from "@/lib/adapters";
import { TVWatchProvider } from "@/lib/watch-context";

export const revalidate = 3600;

/**
 * Layout for all TV watch routes (`/watch/tv/[id]/...`). This is the ONLY
 * place that does server work for the TV watch flow — it fetches the title
 * metadata and the "Similar Shows" row exactly once, then hands the data
 * down to descendant pages via a context provider.
 *
 * Because layouts persist across their own segment changes, navigating
 * from /watch/tv/x/1/1 → /watch/tv/x/1/2 does NOT re-run this code.
 * The page-level [season]/[episode] segment re-renders client-side only
 * (it's a client component using useParams), so the user sees zero
 * loading flash when switching episodes.
 */
export default async function TVWatchLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  // Fetch title + related ONCE per title (not per episode).
  const details = await getBoxmoviesDetail(id).catch(() => null);
  if (!details) notFound();

  // If the title is actually a movie, redirect to the movie watch route.
  if (details.kind === "movie") {
    redirect(`/watch/movie/${encodeURIComponent(details.detailPath)}`);
  }

  const related = (await getBoxmoviesRelated(details.detailPath, "tv", 12).catch(() => [])).map(toMediaCard);

  return (
    <TVWatchProvider
      details={details}
      related={related}
      watchlistMedia={{
        id: details.detailPath,
        type: "tv",
        title: details.title,
        year: details.releaseDate,
        rating: details.rating ?? 0,
        posterPath: details.posterUrl,
        backdropPath: details.backdropUrl,
        overview: details.synopsis,
      }}
    >
      {children}
    </TVWatchProvider>
  );
}
