import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Film } from "lucide-react";
import { BreadcrumbJsonLd } from "@/components/seo/BreadcrumbJsonLd";
import { MediaGrid } from "@/components/media/MediaGrid";
import { getBoxmoviesBrowse } from "@/lib/data";
import { toMediaCard } from "@/lib/cards";
import { GENRE_PAGES } from "@/lib/genres";
import { clampDescription, pageSeo } from "@/lib/seo";
import type { MediaCard } from "@/lib/types";

export const revalidate = 3600;

interface GenrePageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ type?: string; sort?: string }>;
}

const SORT_OPTIONS: { value: string; label: string }[] = [
  { value: "ForYou", label: "Popular" },
  { value: "Hottest", label: "Hottest" },
  { value: "Latest", label: "Latest" },
  { value: "Rating", label: "Top rated" },
];

export async function generateMetadata({
  params,
}: GenrePageProps): Promise<Metadata> {
  const { id } = await params;
  const genre = GENRE_PAGES.find((g) => g.id === String(id));
  if (!genre) {
    return pageSeo({
      path: `/genres/${encodeURIComponent(id)}`,
      title: "Genre",
      description: "Browse by genre.",
      noindex: true,
    });
  }

  // The description is written out per genre so every one of these pages has
  // its own copy. The Ahrefs audit measured 35 of them with a 61-67 character
  // description (Google rewrites anything under ~120), no <h1> and no
  // og:image, because they were being served as soft-404s by a dead TMDB
  // integration.
  return pageSeo({
    path: `/genres/${genre.id}`,
    title: `${genre.title} Movies & TV Shows — Watch Free`,
    // The floor is applied by pageSeo(), so it is not applied here as well.
    description: clampDescription(genre.description, 160, 0),
    image: "/opengraph-image",
    imageWidth: 1200,
    imageHeight: 630,
    keywords: [
      `${genre.title.toLowerCase()} movies`,
      `${genre.title.toLowerCase()} tv shows`,
      `watch ${genre.title.toLowerCase()} free`,
      `best ${genre.title.toLowerCase()}`,
    ],
  });
}

export default async function GenrePage({
  params,
  searchParams,
}: GenrePageProps) {
  const { id } = await params;
  const sp = await searchParams;
  const genre = GENRE_PAGES.find((g) => g.id === String(id));
  if (!genre) notFound();

  const type = sp.type === "tv" ? "tv" : "movie";
  const sort = SORT_OPTIONS.some((s) => s.value === sp.sort)
    ? (sp.sort as string)
    : "ForYou";

  // The catalogue the site actually serves. The old TMDB integration could not
  // run without TMDB_API_KEY, so these pages answered 200 with no content at
  // all — a soft 404, which is the worst thing a crawler can be handed.
  const browse = await getBoxmoviesBrowse(type === "tv" ? 2 : 1, {
    genre: genre.upstreamGenre,
    sort,
    perPage: 28,
  }).catch(() => null);

  const cards: MediaCard[] = (browse?.items ?? []).map(toMediaCard);

  return (
    <div className="mx-auto max-w-7xl px-4 pb-16 pt-24 md:px-6 lg:px-8">
      <BreadcrumbJsonLd
        items={[
          { name: "Home", path: "/" },
          { name: "Genres", path: "/genres" },
          { name: genre.title, path: `/genres/${genre.id}` },
        ]}
      />

      <header className="mb-8">
        <nav className="mb-2 flex items-center gap-1.5 text-xs text-text-muted">
          <Link href="/genres" className="hover:text-cream">
            Genres
          </Link>
          <span>/</span>
          <span className="text-text-secondary">{genre.title}</span>
        </nav>
        <div className="flex items-center gap-2.5">
          <Film className="h-6 w-6 text-accent-bright" aria-hidden />
          <h1 className="font-display text-3xl font-bold text-cream md:text-4xl">
            {genre.title} Movies &amp; TV Shows
          </h1>
        </div>
        <p className="mt-2 max-w-3xl text-sm text-text-secondary md:text-base">
          {genre.description}
        </p>
        <p className="mt-1 text-xs text-text-muted">
          {cards.length} {type === "movie" ? "movies" : "TV shows"} in this
          collection
        </p>

        {/* Type switcher */}
        <div className="mt-4 flex flex-wrap gap-2">
          {(["movie", "tv"] as const).map((t) => (
            <Link
              key={t}
              href={`/genres/${genre.id}?type=${t}&sort=${sort}`}
              className={`rounded-md border px-4 py-1.5 text-sm transition-colors ${
                type === t
                  ? "border-accent bg-accent text-cream"
                  : "border-border bg-surface/40 text-text-secondary hover:border-accent/60"
              }`}
            >
              {t === "movie" ? "Movies" : "TV Shows"}
            </Link>
          ))}
          {SORT_OPTIONS.map((s) => (
            <Link
              key={s.value}
              href={`/genres/${genre.id}?type=${type}&sort=${s.value}`}
              className={`rounded-md border px-3 py-1.5 text-sm transition-colors ${
                sort === s.value
                  ? "border-accent/60 bg-surface-elevated text-cream"
                  : "border-border bg-surface/40 text-text-secondary hover:border-accent/60"
              }`}
            >
              {s.label}
            </Link>
          ))}
        </div>
      </header>

      <MediaGrid
        items={cards}
        emptyMessage={`No ${genre.title.toLowerCase()} titles in this collection right now.`}
      />

      {/* Every other genre, so the genre pages are linked to each other and a
          crawler can walk the whole genre graph instead of finding islands. */}
      <nav aria-label="Other genres" className="mt-10 border-t border-border pt-6">
        <h2 className="mb-3 text-sm font-semibold text-cream">
          Browse other genres
        </h2>
        <ul className="flex flex-wrap gap-2">
          {GENRE_PAGES.filter((g) => g.id !== genre.id).map((g) => (
            <li key={g.id}>
              <Link
                href={`/genres/${g.id}`}
                className="inline-block rounded-full border border-border px-3 py-1.5 text-xs text-text-secondary transition-colors hover:border-accent hover:text-cream"
              >
                {g.title}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
