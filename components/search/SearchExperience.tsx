"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Flame,
  Loader2,
  Search,
  SearchX,
  TrendingUp,
  X,
} from "lucide-react";
import { SearchChip } from "./SearchChip";
import { SearchFilters } from "./SearchFilters";
import { SearchResultRow } from "./SearchResultRow";
import { SearchSectionHeader } from "./SearchSectionHeader";
import {
  EMPTY_SEARCH_FILTERS,
  SEARCH_TABS,
  applySearchFilters,
  buildFacets,
  type SearchCard,
  type SearchFilters,
  type SearchTabId,
} from "@/lib/search";
import { cn } from "@/lib/utils";

/**
 * The search screen.
 *
 * This is the app's search screen, ported:
 *
 *   1. a stretched search field with the *Search* action inside it,
 *   2. a **Recent** row of the visitor's own terms, with a *Clear* button,
 *   3. an **Everyone is searching** row of the catalogue's trending terms,
 *   4. the catalogue tabs — *All*, *Movie*, *Series* and *Short TV*,
 *   5. the ranked results, each with its rank badge and score,
 *   6. and, while the visitor is still typing, the words the upstream
 *      suggests instead of results.
 *
 * The app's own filter sheet has no server-side equivalent here: the
 * upstream's search endpoint honours `subjectType` and nothing else
 * (measured 2026-11-09 — see lib/search.ts). The catalogue tabs are that
 * real upstream filter; the genre / year / country / rating axes are applied
 * here to the titles the upstream really returned, and the panel always says
 * how many of them matched.
 *
 * Nothing on this screen is invented: every title, rating, year, genre and
 * country comes from a catalogue response.
 */

const RECENT_KEY = "movbox.recentSearches";
const RECENT_MAX = 8;
const SUGGEST_DEBOUNCE_MS = 260;

function readRecent(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(RECENT_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((t): t is string => typeof t === "string" && t.trim().length > 0)
      .slice(0, RECENT_MAX);
  } catch {
    return [];
  }
}

function writeRecent(terms: string[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(RECENT_KEY, JSON.stringify(terms));
  } catch {
    /* private mode — the row simply stays empty */
  }
}

export interface SearchExperienceProps {
  initialQuery: string;
  initialTab: SearchTabId;
  /** The "Everyone is searching" terms, per catalogue tab. */
  trending: Record<string, string[]>;
  /** The "Top rankings" rows, per catalogue tab. */
  ranked: Record<string, SearchCard[]>;
}

export function SearchExperience({
  initialQuery,
  initialTab,
  trending,
  ranked,
}: SearchExperienceProps) {
  const [query, setQuery] = useState(initialQuery);
  const [committed, setCommitted] = useState(initialQuery);
  const [tab, setTab] = useState<SearchTabId>(initialTab);
  const [cards, setCards] = useState<SearchCard[]>([]);
  const [pager, setPager] = useState<{
    hasMore: boolean;
    nextPage: number | null;
    totalCount: number | null;
  }>({ hasMore: false, nextPage: null, totalCount: null });
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<SearchFilters>(EMPTY_SEARCH_FILTERS);
  const [panelOpen, setPanelOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [recent, setRecent] = useState<string[]>([]);
  const [mounted, setMounted] = useState(false);

  const inputRef = useRef<HTMLInputElement | null>(null);
  const requestId = useRef(0);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  // ---- recent searches -----------------------------------------------------

  useEffect(() => {
    setMounted(true);
    setRecent(readRecent());
  }, []);

  const remember = useCallback((term: string) => {
    const clean = term.trim();
    if (!clean) return;
    setRecent((prev) => {
      const next = [clean, ...prev.filter((t) => t !== clean)].slice(
        0,
        RECENT_MAX
      );
      writeRecent(next);
      return next;
    });
  }, []);

  const clearRecent = useCallback(() => {
    setRecent([]);
    writeRecent([]);
  }, []);

  // ---- the search itself ---------------------------------------------------

  const runSearch = useCallback(
    async (keyword: string, nextTab: SearchTabId, page = 1, append = false) => {
      const clean = keyword.trim();
      if (!clean) return;

      const id = ++requestId.current;
      if (append) setLoadingMore(true);
      else setLoading(true);
      setError(null);

      try {
        const res = await fetch(
          `/api/search?q=${encodeURIComponent(clean)}&tab=${nextTab}&page=${page}`,
          { headers: { Accept: "application/json" } }
        );
        const j = await res.json();
        if (id !== requestId.current) return;

        if (!j || j.ok === false) {
          setError(
            (j && j.error) || `Search failed (HTTP ${res.status}). Please try again.`
          );
          if (!append) {
            setCards([]);
            setPager({ hasMore: false, nextPage: null, totalCount: null });
          }
          return;
        }

        const items: SearchCard[] = Array.isArray(j.items) ? j.items : [];
        setCards((prev) => (append ? [...prev, ...items] : items));
        const p = j.pager || {};
        setPager({
          hasMore: !!p.hasMore,
          nextPage: p.nextPage != null ? Number(p.nextPage) : null,
          totalCount: p.totalCount != null ? Number(p.totalCount) : null,
        });
      } catch (e) {
        if (id !== requestId.current) return;
        setError(
          e instanceof Error ? e.message : "Search failed. Please try again."
        );
      } finally {
        if (id === requestId.current) {
          setLoading(false);
          setLoadingMore(false);
        }
      }
    },
    []
  );

  // The first search, when the page was opened with a query.
  const bootstrapped = useRef(false);
  useEffect(() => {
    if (bootstrapped.current) return;
    bootstrapped.current = true;
    if (initialQuery.trim()) {
      remember(initialQuery.trim());
      runSearch(initialQuery, initialTab, 1, false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submit = useCallback(
    (term?: string) => {
      const keyword = (term ?? query).trim();
      if (!keyword) return;
      setQuery(keyword);
      setCommitted(keyword);
      setFilters(EMPTY_SEARCH_FILTERS);
      remember(keyword);
      setSuggestions([]);
      inputRef.current?.blur();
      runSearch(keyword, tab, 1, false);
      try {
        const url = new URL(window.location.href);
        url.searchParams.set("q", keyword);
        url.searchParams.set("tab", tab);
        window.history.replaceState(null, "", url.toString());
      } catch {
        /* history is a nicety, never a failure */
      }
    },
    [query, tab, remember, runSearch]
  );

  const selectTab = useCallback(
    (next: SearchTabId) => {
      if (next === tab) return;
      setTab(next);
      setFilters(EMPTY_SEARCH_FILTERS);
      try {
        const url = new URL(window.location.href);
        url.searchParams.set("tab", next);
        window.history.replaceState(null, "", url.toString());
      } catch {
        /* ignore */
      }
      if (committed.trim()) {
        runSearch(committed, next, 1, false);
      }
    },
    [tab, committed, runSearch]
  );

  const loadMore = useCallback(() => {
    if (loadingMore || loading || !pager.hasMore) return;
    const next = pager.nextPage ?? cards.length / 28 + 1;
    runSearch(committed, tab, next, true);
  }, [loadingMore, loading, pager, cards.length, committed, tab, runSearch]);

  // Load the next page automatically when the sentinel scrolls into view.
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) loadMore();
      },
      { rootMargin: "600px 0px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [loadMore]);

  // ---- suggestions ---------------------------------------------------------

  useEffect(() => {
    const keyword = query.trim();
    if (keyword.length < 2) {
      setSuggestions([]);
      return;
    }
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/search-suggest?q=${encodeURIComponent(keyword)}`,
          { headers: { Accept: "application/json" } }
        );
        const j = await res.json();
        if (cancelled) return;
        setSuggestions(
          Array.isArray(j?.suggestions) ? j.suggestions.slice(0, 12) : []
        );
      } catch {
        if (!cancelled) setSuggestions([]);
      }
    }, SUGGEST_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [query]);

  // "/" focuses the field, the way a search-first product should.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (
        t &&
        (t.tagName === "INPUT" ||
          t.tagName === "TEXTAREA" ||
          t.isContentEditable)
      ) {
        return;
      }
      e.preventDefault();
      inputRef.current?.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // ---- derived -------------------------------------------------------------

  const isTyping = query.trim().length > 0 && query.trim() !== committed;
  const hasResults = committed.trim().length > 0;

  const filtered = useMemo(
    () => applySearchFilters(cards, filters),
    [cards, filters]
  );
  const facets = useMemo(() => buildFacets(cards), [cards]);

  const tabTrending = trending[tab] ?? trending.all ?? [];
  const tabRanked = ranked[tab] ?? ranked.all ?? [];

  const matched = hasResults ? filtered.length : 0;

  // ---- render --------------------------------------------------------------

  return (
    <div className="mx-auto w-full max-w-4xl px-4 pb-24 md:px-6">
      {/* ---- the field ---- */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="relative"
        role="search"
      >
        <div className="flex h-[52px] items-center gap-2 rounded-full border border-border bg-surface-elevated pl-4 pr-1.5 transition-all duration-300 focus-within:border-accent focus-within:shadow-glow sm:h-[56px] sm:pl-5">
          <Search className="h-[18px] w-[18px] shrink-0 text-text-secondary" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search movies, series and short TV"
            autoComplete="off"
            spellCheck={false}
            aria-label="Search movies, series and short TV"
            className="h-full min-w-0 flex-1 bg-transparent text-[15px] text-cream outline-none placeholder:text-text-muted sm:text-base"
          />
          {query ? (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                setSuggestions([]);
                inputRef.current?.focus();
              }}
              aria-label="Clear the search field"
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-text-muted transition hover:bg-surface-hover hover:text-cream"
            >
              <X className="h-4 w-4" />
            </button>
          ) : null}
          <button
            type="submit"
            className="h-10 shrink-0 rounded-full bg-brand px-4 text-[13px] font-bold text-cream transition-all duration-200 hover:bg-accent hover:shadow-glow sm:px-5"
          >
            Search
          </button>
        </div>
      </form>

      {/* ---- the catalogue tabs ---- */}
      <div
        role="tablist"
        aria-label="Catalogue"
        className="no-scrollbar mt-4 flex items-center gap-1 overflow-x-auto border-b border-border"
      >
        {SEARCH_TABS.map((t) => {
          const on = t.id === tab;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => selectTab(t.id)}
              className={cn(
                "relative flex shrink-0 items-center gap-1.5 px-3 py-2.5 text-[13.5px] transition-colors duration-200 sm:text-sm",
                on
                  ? "font-bold text-cream"
                  : "font-normal text-text-secondary hover:text-cream"
              )}
            >
              {on ? (
                <TrendingUp className="h-4 w-4 text-accent-bright" aria-hidden />
              ) : null}
              {t.label}
              {on ? (
                <span
                  aria-hidden
                  className="absolute inset-x-2 -bottom-px h-[2px] rounded-full bg-brand"
                />
              ) : null}
            </button>
          );
        })}
      </div>

      {/* ---- the suggestions, while the visitor is still typing ---- */}
      {isTyping && suggestions.length ? (
        <>
          <SearchSectionHeader title="Suggestions" />
          <div className="flex flex-wrap gap-2">
            {suggestions.map((s) => (
              <SearchChip key={s} text={s} onClick={() => submit(s)} />
            ))}
          </div>
        </>
      ) : null}

      {/* ---- the landing state ---- */}
      {!hasResults ? (
        <>
          {mounted && recent.length ? (
            <>
              <SearchSectionHeader
                title="Recent"
                action={
                  <button
                    type="button"
                    onClick={clearRecent}
                    className="text-[12px] font-medium text-text-muted transition hover:text-accent-bright"
                  >
                    Clear
                  </button>
                }
              />
              <div className="flex flex-wrap gap-2">
                {recent.map((term) => (
                  <SearchChip
                    key={term}
                    text={term}
                    onClick={() => submit(term)}
                  />
                ))}
              </div>
            </>
          ) : null}

          {tabTrending.length ? (
            <>
              <SearchSectionHeader title="🔥 Everyone is searching" />
              <div className="flex flex-wrap gap-2">
                {tabTrending.map((term) => (
                  <SearchChip
                    key={term}
                    text={term}
                    onClick={() => submit(term)}
                  />
                ))}
              </div>
            </>
          ) : null}

          {tabRanked.length ? (
            <>
              <SearchSectionHeader title="Top rankings" />
              <div className="flex flex-col">
                {tabRanked.slice(0, 20).map((card, i) => (
                  <SearchResultRow key={`${card.id}-${i}`} card={card} rank={i + 1} />
                ))}
              </div>
            </>
          ) : null}
        </>
      ) : null}

      {/* ---- the results ---- */}
      {hasResults ? (
        <>
          <div className="mt-5">
            <SearchFilters
              facets={facets}
              filters={filters}
              onChange={setFilters}
              open={panelOpen}
              onToggleOpen={() => setPanelOpen((v) => !v)}
              matched={matched}
              loaded={cards.length}
              totalCount={pager.totalCount}
            />
          </div>

          <SearchSectionHeader
            title={`Results for “${committed}”`}
            count={matched}
          />

          {loading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-text-muted">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm">Searching…</span>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center gap-3 py-16 text-center">
              <SearchX className="h-8 w-8 text-accent" />
              <p className="text-sm text-text-secondary">{error}</p>
              <button
                type="button"
                onClick={() => runSearch(committed, tab, 1, false)}
                className="rounded-full bg-brand px-5 py-2 text-[13px] font-semibold text-cream transition hover:bg-accent"
              >
                Search again
              </button>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-16 text-center">
              <SearchX className="h-8 w-8 text-text-muted" />
              <p className="text-sm text-text-secondary">
                No titles match those filters.
              </p>
              {filters.genres.length ||
              filters.years.length ||
              filters.countries.length ||
              filters.minRating > 0 ? (
                <button
                  type="button"
                  onClick={() => setFilters(EMPTY_SEARCH_FILTERS)}
                  className="rounded-full border border-border px-5 py-2 text-[13px] font-semibold text-text-secondary transition hover:border-accent hover:text-cream"
                >
                  Reset the filters
                </button>
              ) : (
                <p className="text-[13px] text-text-muted">
                  Nothing in the catalogue matches “{committed}”.
                </p>
              )}
            </div>
          ) : (
            <>
              <div className="flex flex-col">
                {filtered.map((card, i) => (
                  <SearchResultRow
                    key={`${card.id}-${i}`}
                    card={card}
                    rank={i + 1}
                  />
                ))}
              </div>

              {pager.hasMore ? (
                <>
                  <div ref={sentinelRef} aria-hidden className="h-px w-full" />
                  <div className="mt-6 flex justify-center">
                    <button
                      type="button"
                      onClick={loadMore}
                      disabled={loadingMore}
                      className="inline-flex h-11 items-center gap-2 rounded-full border border-border bg-surface-elevated px-7 text-[13.5px] font-semibold text-cream transition-all duration-200 hover:border-accent hover:shadow-glow disabled:opacity-60"
                    >
                      {loadingMore ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : null}
                      {loadingMore ? "Loading…" : "Load more"}
                    </button>
                  </div>
                </>
              ) : (
                <p className="mt-8 flex items-center justify-center gap-2 text-[13px] text-text-muted">
                  <Flame className="h-3.5 w-3.5 text-accent-bright" />
                  That is everything the catalogue returned.
                </p>
              )}
            </>
          )}
        </>
      ) : null}
    </div>
  );
}
