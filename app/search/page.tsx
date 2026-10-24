import type { Metadata } from "next";
import { Suspense } from "react";
import { SearchClient } from "./SearchClient";
import { pageSeo } from "@/lib/seo";

export const metadata: Metadata = pageSeo({
  path: "/search",
  title: "Search",
  description: "Search for movies and TV shows on Movbox.",
  noindex: true,
});

interface SearchPageProps {
  searchParams: Promise<{ q?: string; type?: string }>;
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const params = await searchParams;
  const q = params.q ?? "";
  const type = (params.type ?? "all") as "all" | "movie" | "tv";

  return (
    <div className="mx-auto max-w-7xl px-4 pb-16 pt-24 md:px-6 lg:px-8">
      <header className="mb-8">
        <h1 className="font-display text-3xl font-bold text-cream md:text-4xl">
          Search
        </h1>
        {q ? (
          <p className="mt-2 text-sm text-text-secondary md:text-base">
            Results for{" "}
            <span className="font-semibold text-cream">&quot;{q}&quot;</span>
          </p>
        ) : (
          <p className="mt-2 text-sm text-text-secondary md:text-base">
            Find your next favorite movie or TV show.
          </p>
        )}
      </header>

      <Suspense
        fallback={
          <div className="py-20 text-center text-text-muted">Loading…</div>
        }
      >
        <SearchClient q={q} type={type} />
      </Suspense>
    </div>
  );
}
