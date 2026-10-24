import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FilterSidebar } from "@/components/browse/FilterSidebar";
import { MediaGrid } from "@/components/media/MediaGrid";
import { discoverMovies, discoverTV, getMovieGenres, getTVGenres } from "@/lib/tmdb";
import { toMovieCard, toTVCard } from "@/lib/media";
import { MOVIE_GENRES } from "@/lib/constants";
import { pageSeo } from "@/lib/seo";

export const revalidate = 3600;

interface GenrePageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ type?: string; sort?: string }>;
}

export async function generateMetadata({
  params,
}: GenrePageProps): Promise<Metadata> {
  const { id } = await params;
  const [movieGenres, tvGenres] = await Promise.all([
    getMovieGenres().catch(() => ({ genres: [] })),
    getTVGenres().catch(() => ({ genres: [] })),
  ]);
  const all = [...movieGenres.genres, ...tvGenres.genres];
  const found = all.find((g) => String(g.id) === id);
  if (!found) {
    return pageSeo({
      path: `/genres/${encodeURIComponent(id)}`,
      title: "Genre",
      description: "Browse by genre.",
      noindex: true,
    });
  }
  return pageSeo({
    path: `/genres/${encodeURIComponent(String(found.id))}`,
    title: found.name,
    description: `Browse ${found.name} movies and TV shows. Stream them free on Movbox.`,
  });
}

export default async function GenrePage({
  params,
  searchParams,
}: GenrePageProps) {
  const { id } = await params;
  const sp = await searchParams;
  const numericId = Number(id);
  if (!Number.isFinite(numericId) || numericId <= 0) notFound();
  const type = (sp.type ?? "movie") as "movie" | "tv";
  const sort = (sp.sort ?? "popularity.desc") as
    | "popularity.desc"
    | "vote_average.desc"
    | "primary_release_date.desc"
    | "first_air_date.desc"
    | "revenue.desc";

  const [movieGenres, tvGenres, moviesData, tvData] = await Promise.all([
    getMovieGenres().catch(() => ({ genres: [] })),
    getTVGenres().catch(() => ({ genres: [] })),
    type === "movie"
      ? discoverMovies({
          with_genres: String(numericId),
          sort_by: sort as
            | "popularity.desc"
            | "vote_average.desc"
            | "primary_release_date.desc"
            | "revenue.desc",
        })
      : Promise.resolve(null),
    type === "tv"
      ? discoverTV({
          with_genres: String(numericId),
          sort_by: sort as
            | "popularity.desc"
            | "vote_average.desc"
            | "first_air_date.desc",
        })
      : Promise.resolve(null),
  ]);

  const allGenres = [...movieGenres.genres, ...tvGenres.genres];
  const genre = allGenres.find((g) => g.id === numericId);
  if (!genre) notFound();

  const cards =
    type === "movie"
      ? (moviesData?.results ?? [])
          .filter((m) => !!m.poster_path)
          .map(toMovieCard)
      : (tvData?.results ?? [])
          .filter((t) => !!t.poster_path)
          .map(toTVCard);

  return (
    <div className="mx-auto max-w-7xl px-4 pb-16 pt-24 md:px-6 lg:px-8">
      <header className="mb-8">
        <nav className="mb-2 flex items-center gap-1.5 text-xs text-text-muted">
          <a href="/genres" className="hover:text-cream">
            Genres
          </a>
          <span>/</span>
          <span className="text-text-secondary">{genre.name}</span>
        </nav>
        <h1 className="font-display text-3xl font-bold text-cream md:text-4xl">
          {genre.name}
        </h1>
        <p className="mt-2 text-sm text-text-secondary md:text-base">
          {cards.length} {type === "movie" ? "movies" : "TV shows"}
        </p>

        {/* Type switcher */}
        <div className="mt-4 flex gap-2">
          <a
            href={`/genres/${id}?type=movie`}
            className={`rounded-md border px-4 py-1.5 text-sm ${
              type === "movie"
                ? "border-accent bg-accent text-cream"
                : "border-border bg-surface/40 text-text-secondary hover:border-accent/60"
            }`}
          >
            Movies
          </a>
          <a
            href={`/genres/${id}?type=tv`}
            className={`rounded-md border px-4 py-1.5 text-sm ${
              type === "tv"
                ? "border-accent bg-accent text-cream"
                : "border-border bg-surface/40 text-text-secondary hover:border-accent/60"
            }`}
          >
            TV Shows
          </a>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[260px_1fr]">
        <FilterSidebar mediaType={type} baseGenreId={numericId} />
        <MediaGrid
          items={cards}
          emptyMessage="No titles in this genre."
        />
      </div>
    </div>
  );
}
