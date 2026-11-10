import type { Metadata } from "next";
import Link from "next/link";
import { Sparkles } from "lucide-react";
import { BreadcrumbJsonLd } from "@/components/seo/BreadcrumbJsonLd";
import { GENRE_PAGES } from "@/lib/genres";
import { pageSeo } from "@/lib/seo";

export const revalidate = 3600;

export const metadata: Metadata = pageSeo({
  path: "/genres",
  title: "Browse by Genre — Action, Romance, Horror, Comedy & More",
  description:
    "Find your next watch by genre. Browse action, adventure, animation, comedy, crime, drama, horror, romance, sci-fi and thriller movies and series, free in HD.",
  image: "/opengraph-image",
  imageWidth: 1200,
  imageHeight: 630,
  keywords: [
    "movies by genre",
    "tv shows by genre",
    "action movies",
    "romance drama",
    "horror movies",
  ],
});

export default async function GenresPage() {
  // This page used to read the TMDB genre list. Without TMDB_API_KEY it
  // rendered an EMPTY grid, so /genres was a page that linked to nothing and
  // the 18 genre pages below it were unreachable — they were the orphans the
  // Ahrefs audit counted.
  //
  // The genre list is now the site's own, and it is the same list the genre
  // pages are built from, so every genre page is linked from here.
  const genres = [...GENRE_PAGES].sort((a, b) =>
    a.title.localeCompare(b.title)
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
        <p className="mt-2 max-w-2xl text-sm text-text-secondary md:text-base">
          Pick a genre to discover new favourites — every collection is served
          from the Movbox catalogue, so every title below streams free in HD.
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
                {g.title}
              </h2>
              <p className="mt-0.5 text-xs text-cream/60">Movies &amp; TV</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
