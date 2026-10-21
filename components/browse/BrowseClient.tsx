"use client";

/**
 * BrowseClient â€” shared client component for /movies, /tv, /animations.
 * Owns the filter state, calls /api/browse on every change, and renders
 * the <FilterSidebar> + <BrowseGrid> combo in a 2-col grid on desktop.
 * On mobile, the filter sidebar collapses behind a button (handled
 * inside FilterSidebar) and the grid takes full width.
 */

import { useCallback, useState } from "react";
import { FilterSidebar, EMPTY_FILTERS, type FilterState } from "./FilterSidebar";
import { BrowseGrid } from "./BrowseGrid";
import type { BoxMediaCard, FilterOptions } from "@/lib/types";

export interface BrowseClientProps {
  channelId: 1 | 2 | 7;
  showGenreAndLanguage?: boolean;
  options: FilterOptions;
  initialItems: BoxMediaCard[];
  initialHasMore: boolean;
  initialPage: number;
  initialTotalCount: number | null;
  gridTitle: string;
  emptyLabel: string;
}

export function BrowseClient({
  channelId,
  showGenreAndLanguage = true,
  options,
  initialItems,
  initialHasMore,
  initialPage,
  initialTotalCount,
  gridTitle,
  emptyLabel,
}: BrowseClientProps) {
  const [filters, setFilters] = useState<FilterState>({ ...EMPTY_FILTERS });
  const [items, setItems] = useState<BoxMediaCard[]>(initialItems);
  const [page, setPage] = useState(initialPage);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [totalCount, setTotalCount] = useState<number | null>(initialTotalCount);
  const [loading, setLoading] = useState(false);

  const fetchPage = useCallback(
    async (nextFilters: FilterState, nextPage: number, append: boolean) => {
      setLoading(true);
      try {
        const params = new URLSearchParams({ channelId: String(channelId) });
        if (nextFilters.genre) params.set("genre", nextFilters.genre);
        if (nextFilters.country) params.set("country", nextFilters.country);
        if (nextFilters.year) params.set("year", nextFilters.year);
        if (nextFilters.language) params.set("language", nextFilters.language);
        if (nextFilters.sort && nextFilters.sort !== "ForYou" && nextFilters.sort !== "Hottest")
          params.set("sort", nextFilters.sort);
        if (nextPage > 1) params.set("page", String(nextPage));
        const r = await fetch(`/api/browse?${params.toString()}`);
        const j = await r.json();
        if (j.ok) {
          setItems(append ? [...items, ...(j.items ?? [])] : j.items ?? []);
          setHasMore(!!j.hasMore);
          setPage(nextPage);
          setTotalCount(j.totalCount ?? null);
        } else {
          if (!append) setItems([]);
          setHasMore(false);
        }
      } catch (e) {
        if (!append) setItems([]);
        setHasMore(false);
      } finally {
        setLoading(false);
      }
    },
    [channelId, items]
  );

  // When filters change, reset to page 1 and replace items.
  const handleFilterChange = useCallback(
    (next: FilterState) => {
      setFilters(next);
      setItems([]);
      setHasMore(false);
      setPage(1);
      fetchPage(next, 1, false);
    },
    [fetchPage]
  );

  // Infinite-scroll page increment. Stable signature so the IO
  // dependency doesn't churn in the BrowseGrid effect.
  const goNextPage = useCallback(() => {
    if (loading || !hasMore) return;
    setPage((p) => {
      const next = p + 1;
      fetchPage(filters, next, true);
      return next;
    });
  }, [loading, hasMore, filters, fetchPage]);

  return (
    <div className="mx-auto w-full max-w-[1500px] px-3 py-4 sm:px-5 md:px-6 md:py-6">
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[240px_1fr] lg:gap-6">
        <FilterSidebar
          options={options}
          filters={filters}
          onChange={handleFilterChange}
          showGenreAndLanguage={showGenreAndLanguage}
          totalCount={totalCount}
        />
        <div>
          <BrowseGrid
            items={items}
            loading={loading}
            hasMore={hasMore}
            page={page}
            onPage={goNextPage}
            totalCount={totalCount}
            title={gridTitle}
            emptyLabel={emptyLabel}
          />
        </div>
      </div>
    </div>
  );
}
