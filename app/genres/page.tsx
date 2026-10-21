import type { Metadata } from "next";
import Link from "next/link";
import { Sparkles } from "lucide-react";
import { getMovieGenres, getTVGenres } from "@/lib/tmdb";
import { BreadcrumbJsonLd } from "@/components/seo/BreadcrumbJsonLd";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Genres — Movbox",
  description: "Browse movies and TV shows by genre.",
};

export default async function GenresPage() {
  const [movieGenres, tvGenres] = await Promise.all([
    getMovieGenres().catch(() => ({ genres: [] })),
    getTVGenres().catch(() => ({ genres: [] })),
  ]);

  // Merge: show all unique genres with their respective ids
  const allGenres = new Map<
    number,
    { id: number; name: string; movie: boolean; tv: boolean }
  >();
  for (const g of movieGenres.genres) {
    allGenres.set(g.id, { id: g.id, name: g.name, movie: true, tv: false });
  }
  for (const g of tvGenres.genres) {
    const existing = allGenres.get(g.id);
    if (existing) existing.tv = true;
    else allGenres.set(g.id, { id: g.id, name: g.name, movie: false, tv: true });
  }
  const genres = Array.from(allGenres.values()).sort((a, b) =>
    a.name.localeCompare(b.name)
  );

  return (
    <div className="mx-auto max-w-7xl px-4 pb-16 pt-24 md:px-6 lg:px-8">
      <BreadcrumbJsonLd
        items={[
          { name: "Home", path: "/" },
          { name: "Genres", path: "/genres" },
        ]}
      />
      <header className="mb-8">
        <h1 className="font-display text-3xl font-bold text-cream md:text-4xl">
          Genres
        </h1>
        <p className="mt-2 text-sm text-text-secondary md:text-base">
          Pick a genre to discover new favorites.
        </p>
      </header>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {genres.map((g) => (
          <Link
            key={g.id}
            href={`/genres/${g.id}`}
            className="group relative flex aspect-[3/2] items-end overflow-hidden rounded-xl border border-border bg-surface p-4 shadow-card transition-all hover:scale-[1.02] hover:border-accent hover:shadow-glow"
          >
            {/* Decorative gradient bg */}
            <div
              className="absolute inset-0"
              style={{
                background:
                  "linear-gradient(135deg, rgba(128, 0, 32, 0.7), rgba(164, 46, 74, 0.5), rgba(13, 9, 9, 0.95))",
              }}
            />
            <div className="absolute inset-0 gradient-bottom" />
            <Sparkles className="absolute right-3 top-3 h-4 w-4 text-cream/30 transition-transform group-hover:scale-125 group-hover:text-cream" />
            <div className="relative">
              <h2 className="font-display text-lg font-semibold text-cream">
                {g.name}
              </h2>
              <p className="mt-0.5 text-xs text-cream/60">
                {g.movie && g.tv ? "Movies & TV" : g.movie ? "Movies" : "TV"}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
