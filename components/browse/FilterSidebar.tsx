"use client";

/**
 * FilterSidebar — vertical column of <FilterChips> sections for the
 * browse pages. Matches the boxmovies.org sidebar pattern: each axis
 * (Genre / Country / Language / Year / Sort) is a small collapsible
 * section with a chip cloud.
 *
 * Desktop: sticky left column inside a 2-col grid (sidebar + grid).
 * Mobile:  hidden by default; "Filters" button opens a fullscreen sheet
 *          with a drag handle + dim backdrop.
 */

import { useState } from "react";
import { Filter as FilterIcon, X } from "lucide-react";
import { FilterChips } from "./FilterChips";
import type { FilterOptions } from "@/lib/data";

export interface FilterState {
  genre: string | null;
  country: string | null;
  year: string | null;
  language: string | null;
  sort: string;
}

export const EMPTY_FILTERS: FilterState = {
  genre: null,
  country: null,
  year: null,
  language: null,
  sort: "Hottest",
};

export interface FilterSidebarProps {
  options: FilterOptions;
  filters: FilterState;
  onChange: (next: FilterState) => void;
  /** Discriminator for the BrowseGrid context. Filters the year
   *  and country dropdowns to movie- or tv-appropriate values. */
  mediaType?: "movie" | "tv";
  /** Optional pre-selected genre ID. Used by /genres/[id] so the
   *  "genre" pill in the sidebar shows the active genre. */
  baseGenreId?: number;
  /**
   * If true, render Genre + Language axes. /animations sets this false.
   */
  showGenreAndLanguage?: boolean;
  totalCount?: number | null;
}

function activeCount(f: FilterState, includeGenre: boolean): number {
  let n = 0;
  if (includeGenre && f.genre) n++;
  if (f.country) n++;
  if (f.year) n++;
  if (includeGenre && f.language) n++;
  if (f.sort && f.sort !== "ForYou" && f.sort !== "Hottest") n++;
  return n;
}

export function FilterSidebar({
  options,
  filters,
  onChange,
  showGenreAndLanguage = true,
  totalCount,
}: FilterSidebarProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const filtersActive = activeCount(filters, showGenreAndLanguage);

  const body = (
    <div>
      {showGenreAndLanguage && (
        <FilterChips
          label="Genre"
          options={options.genre}
          value={filters.genre}
          onChange={(v) => onChange({ ...filters, genre: v, page: 1 } as any)}
        />
      )}
      <FilterChips
        label="Country"
        options={options.country}
        value={filters.country}
        onChange={(v) => onChange({ ...filters, country: v, page: 1 } as any)}
        size="sm"
      />
      {showGenreAndLanguage && (
        <FilterChips
          label="Language"
          options={options.language}
          value={filters.language}
          onChange={(v) => onChange({ ...filters, language: v, page: 1 } as any)}
        />
      )}
      <FilterChips
        label="Year"
        options={options.year}
        value={filters.year}
        onChange={(v) => onChange({ ...filters, year: v, page: 1 } as any)}
        size="sm"
      />
      <FilterChips
        label="Sort by"
        options={options.sort}
        value={filters.sort}
        onChange={(v) => onChange({ ...filters, sort: v || "ForYou", page: 1 } as any)}
        showAll={false}
      />
    </div>
  );

  return (
    <>
      {/* Mobile filter trigger + result count */}
      <div className="mb-3 flex items-center gap-2 lg:hidden">
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          className="flex flex-1 items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900/60 px-3.5 py-2 text-sm font-medium text-zinc-200"
        >
          <span className="flex items-center gap-2">
            <FilterIcon className="h-3.5 w-3.5" />
            Filters
            {filtersActive > 0 && (
              <span className="rounded-full bg-burgundy-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
                {filtersActive}
              </span>
            )}
          </span>
          <span className="text-[11px] text-zinc-500">
            {totalCount != null ? `${totalCount.toLocaleString()} results` : ""}
          </span>
        </button>
        {filtersActive > 0 && (
          <button
            type="button"
            onClick={() => onChange({ ...EMPTY_FILTERS })}
            className="rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-2 text-xs text-zinc-400 hover:text-zinc-200"
          >
            Clear
          </button>
        )}
      </div>

      {/* Mobile fullscreen sheet */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex flex-col bg-bg-deepest/95 backdrop-blur lg:hidden">
          <div className="flex items-center justify-between border-b border-zinc-800 bg-zinc-950 px-4 py-3">
            <div className="flex items-center gap-2">
              <FilterIcon className="h-4 w-4 text-accent-bright" />
              <div className="text-sm font-semibold text-zinc-100">Filters</div>
              {filtersActive > 0 && (
                <span className="rounded-full bg-burgundy-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
                  {filtersActive}
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              aria-label="Close filters"
              className="rounded-full p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-4 py-2">{body}</div>
          <div className="flex items-center gap-2 border-t border-zinc-800 bg-zinc-950 p-3">
            {filtersActive > 0 && (
              <button
                type="button"
                onClick={() => onChange({ ...EMPTY_FILTERS })}
                className="rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-2.5 text-xs text-zinc-300 hover:text-zinc-100"
              >
                Clear
              </button>
            )}
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              className="flex-1 rounded-lg bg-brand py-2.5 text-sm font-semibold text-cream hover:bg-accent"
            >
              {totalCount != null
                ? `Show ${totalCount.toLocaleString()} results`
                : "Show results"}
            </button>
          </div>
        </div>
      )}

      {/* Desktop sticky column */}
      <aside className="sticky top-20 hidden self-start lg:block">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.14em] text-zinc-300">
            <FilterIcon className="h-3 w-3 text-accent-bright" />
            Filters
            {filtersActive > 0 && (
              <span className="rounded-full bg-burgundy-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
                {filtersActive}
              </span>
            )}
          </h2>
          {filtersActive > 0 && (
            <button
              type="button"
              onClick={() => onChange({ ...EMPTY_FILTERS })}
              className="text-[11px] text-zinc-500 hover:text-zinc-200"
            >
              Clear
            </button>
          )}
        </div>
        <div className="rounded-xl border border-zinc-800/80 bg-zinc-950/60 p-3.5 backdrop-blur">
          {body}
        </div>
        {totalCount != null && (
          <div className="mt-2 px-1 text-[11px] text-zinc-500">
            {totalCount.toLocaleString()} results
          </div>
        )}
      </aside>
    </>
  );
}
