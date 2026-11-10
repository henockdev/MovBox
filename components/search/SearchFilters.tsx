"use client";

import { SlidersHorizontal, Star } from "lucide-react";
import { useState } from "react";
import { SearchChip } from "./SearchChip";
import {
  EMPTY_SEARCH_FILTERS,
  SEARCH_SORTS,
  activeFilterCount,
  toggleFilterValue,
  type SearchFacets,
  type SearchFilters,
  type SortKey,
} from "@/lib/search";
import { cn } from "@/lib/utils";

/**
 * The filter panel.
 *
 * The upstream's search endpoint honours `subjectType` and nothing else
 * (measured 2026-11-09 — see lib/search.ts), so the genre / year / country /
 * rating axes are applied here to the titles the upstream really returned.
 *
 * Every value offered comes from a field on one of those titles: the genres
 * and the countries and the years are counted from the current result set, so
 * a filter can never return nothing. The panel states how many titles are
 * matched and how many were loaded, so the narrowing is never a mystery.
 */

const RATING_STEPS = [0, 6, 7, 8];

function FacetColumn({
  title,
  items,
  selected,
  onToggle,
  limit = 18,
}: {
  title: string;
  items: { value: string; count: number }[];
  selected: string[];
  onToggle: (value: string) => void;
  limit?: number;
}) {
  const [expanded, setExpanded] = useState(false);
  if (!items.length) return null;
  const shown = expanded ? items : items.slice(0, limit);

  return (
    <div>
      <h3 className="mb-2.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-text-muted">
        {title}
      </h3>
      <div className="flex flex-wrap gap-1.5">
        {shown.map((f) => (
          <SearchChip
            key={f.value}
            text={f.value}
            active={selected.includes(f.value)}
            onClick={() => onToggle(f.value)}
            title={`${f.value} — ${f.count} title${f.count === 1 ? "" : "s"}`}
          />
        ))}
      </div>
      {items.length > limit ? (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-2 text-[12px] font-medium text-accent-bright transition hover:text-cream"
        >
          {expanded ? "Show fewer" : `Show all ${items.length}`}
        </button>
      ) : null}
    </div>
  );
}

export interface SearchFiltersProps {
  facets: SearchFacets;
  filters: SearchFilters;
  onChange: (next: SearchFilters) => void;
  open: boolean;
  onToggleOpen: () => void;
  /** How many titles the current filters match. */
  matched: number;
  /** How many titles have been loaded from the upstream. */
  loaded: number;
  /** The upstream's own total for this search, when it reports one. */
  totalCount: number | null;
}

export function SearchFilters({
  facets,
  filters,
  onChange,
  open,
  onToggleOpen,
  matched,
  loaded,
  totalCount,
}: SearchFiltersProps) {
  const active = activeFilterCount(filters);
  const dirty = active > 0;

  return (
    <div>
      {/* ---- the toolbar: sort + filters ---- */}
      <div className="flex flex-wrap items-center gap-2">
        <div
          role="group"
          aria-label="Sort results"
          className="flex items-center gap-1 rounded-full border border-border bg-surface-elevated p-1"
        >
          {SEARCH_SORTS.map((s) => {
            const on = filters.sort === s.id;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => onChange({ ...filters, sort: s.id as SortKey })}
                aria-pressed={on}
                className={cn(
                  "h-7 rounded-full px-3 text-[12px] font-medium transition-all duration-200",
                  on
                    ? "bg-brand text-cream shadow-glow"
                    : "text-text-secondary hover:text-cream"
                )}
              >
                {s.label}
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={onToggleOpen}
          aria-expanded={open}
          className={cn(
            "inline-flex h-9 items-center gap-2 rounded-full border px-3.5 text-[12.5px] font-medium transition-all duration-200",
            dirty || open
              ? "border-accent bg-brand/20 text-cream"
              : "border-border bg-surface-elevated text-text-secondary hover:border-accent hover:text-cream"
          )}
        >
          <SlidersHorizontal className="h-[14px] w-[14px]" />
          Filters
          {active > 0 ? (
            <span className="inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-brand px-1 text-[10px] font-bold text-cream">
              {active}
            </span>
          ) : null}
        </button>

        {dirty ? (
          <button
            type="button"
            onClick={() => onChange({ ...EMPTY_SEARCH_FILTERS, sort: filters.sort })}
            className="h-9 rounded-full px-3 text-[12.5px] font-medium text-text-muted transition hover:text-accent-bright"
          >
            Reset
          </button>
        ) : null}

        <p className="ml-auto text-[12px] text-text-muted">
          {matched === loaded ? (
            <>
              <span className="font-semibold text-text-secondary">{matched}</span>{" "}
              title{matched === 1 ? "" : "s"}
            </>
          ) : (
            <>
              <span className="font-semibold text-accent-bright">{matched}</span> of{" "}
              {loaded} loaded
            </>
          )}
          {totalCount != null && totalCount > 0 ? (
            <span className="text-text-muted"> · {totalCount} in the catalogue</span>
          ) : null}
        </p>
      </div>

      {/* ---- the panel ---- */}
      {open ? (
        <div className="mt-3 rounded-2xl border border-border bg-surface/85 p-4 shadow-elevated sm:p-5">
          {active === 0 && matched === loaded ? (
            <p className="mb-4 text-[12.5px] text-text-muted">
              Nothing is narrowed yet. Pick a genre, a year, a country or a
              minimum rating to narrow the {loaded} titles the catalogue
              returned.
            </p>
          ) : null}

          <div className="grid gap-6 md:grid-cols-3">
            <FacetColumn
              title="Genre"
              items={facets.genres}
              selected={filters.genres}
              onToggle={(v) =>
                onChange({
                  ...filters,
                  genres: toggleFilterValue(filters.genres, v),
                })
              }
            />
            <FacetColumn
              title="Year"
              items={facets.years}
              selected={filters.years}
              onToggle={(v) =>
                onChange({
                  ...filters,
                  years: toggleFilterValue(filters.years, v),
                })
              }
            />
            <FacetColumn
              title="Country"
              items={facets.countries}
              selected={filters.countries}
              onToggle={(v) =>
                onChange({
                  ...filters,
                  countries: toggleFilterValue(filters.countries, v),
                })
              }
            />
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-border pt-4">
            <span className="mr-1 inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-text-muted">
              <Star className="h-[12px] w-[12px]" />
              Min rating
            </span>
            {RATING_STEPS.map((r) => (
              <SearchChip
                key={r}
                text={r === 0 ? "Any" : `${r}+`}
                active={filters.minRating === r}
                onClick={() => onChange({ ...filters, minRating: r })}
              />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
