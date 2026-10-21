"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Film, LayoutGrid, Loader2, Search as SearchIcon, Tv } from "lucide-react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/Skeleton";
import type { BoxMediaCard } from "@/lib/types";

/**
 * Search results page client.
 *
 * Layout mirrors boxmovies.org's /searchResult page:
 *   - "Search results for <q>" title
 *   - 3 pill-style filter tabs: All / Movies / TV Shows
 *   - Grid of cards (poster + golden-star rating + title + burgundy
 *     "Watch now" button)
 *   - Infinite scroll driven by the h5-api pager (hasMore + nextPage)
 *   - "End of results" footer when the user has loaded everything
 *
 * Defensive dedup: h5-api sometimes returns the same detailPath twice
 * (e.g. when a series has both S1 and S2 entries that share a slug).
 * We dedupe on detailPath so React keys are always unique.
 */

type Tab = "all" | "movie" | "tv";

const TABS: Array<{ id: Tab; label: string; icon: React.ElementType }> = [
  { id: "all", label: "All", icon: LayoutGrid },
  { id: "movie", label: "Movies", icon: Film },
  { id: "tv", label: "TV Shows", icon: Tv },
];

const SUBJECT_TYPE: Record<Tab, number> = {
  all: 0,
  movie: 1,
  tv: 2,
};

const PER_PAGE = 28;

interface SearchClientProps {
  q: string;
  type: Tab;
}

interface SearchResponse {
  ok: boolean;
  results?: BoxMediaCard[];
  totalCount?: number | null;
  hasMore?: boolean;
  nextPage?: number | null;
  page?: number;
  error?: string;
}

export function SearchClient({ q: initialQ, type: initialType }: SearchClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [q, setQ] = useState(initialQ);
  const [type, setType] = useState<Tab>(initialType);

  const [items, setItems] = useState<BoxMediaCard[]>([]);
  const [totalCount, setTotalCount] = useState<number | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [nextPage, setNextPage] = useState<number | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const sentinelRef = useRef<HTMLDivElement>(null);
  const requestIdRef = useRef(0);

  // Sync state from URL changes (back/forward, shared links)
  useEffect(() => {
    setQ(initialQ);
    setType(initialType);
  }, [initialQ, initialType]);

  // Fetch when q or type changes — replaces the result list
  useEffect(() => {
    if (!q.trim()) {
      setItems([]);
      setTotalCount(null);
      setHasMore(false);
      setNextPage(null);
      setCurrentPage(1);
      setError(null);
      return;
    }

    const reqId = ++requestIdRef.current;
    setLoading(true);
    setError(null);
    setItems([]);
    setCurrentPage(1);

    const fetchIt = async () => {
      try {
        const res = await fetch(
          `/api/search?q=${encodeURIComponent(q.trim())}&subjectType=${SUBJECT_TYPE[type]}&page=1&perPage=${PER_PAGE}`,
          { cache: "no-store" }
        );
        const j: SearchResponse = await res.json();
        if (reqId !== requestIdRef.current) return; // stale
        if (!j.ok) {
          setError(j.error || "Search failed");
          setItems([]);
          setHasMore(false);
          setNextPage(null);
          return;
        }
        const results = dedupeByPath(j.results ?? []);
        setItems(results);
        setTotalCount(j.totalCount ?? null);
        setHasMore(!!j.hasMore);
        setNextPage(j.nextPage ?? null);
      } catch (err) {
        if (reqId !== requestIdRef.current) return;
        setError(err instanceof Error ? err.message : "Network error");
        setItems([]);
        setHasMore(false);
        setNextPage(null);
      } finally {
        if (reqId === requestIdRef.current) setLoading(false);
      }
    };

    fetchIt();
  }, [q, type]);

  // Infinite scroll: fetch next page when sentinel comes into view
  const loadMore = useCallback(async () => {
    if (!hasMore || loadingMore || !nextPage || !q.trim()) return;
    setLoadingMore(true);
    const reqId = requestIdRef.current;
    try {
      const res = await fetch(
        `/api/search?q=${encodeURIComponent(q.trim())}&subjectType=${SUBJECT_TYPE[type]}&page=${nextPage}&perPage=${PER_PAGE}`,
        { cache: "no-store" }
      );
      const j: SearchResponse = await res.json();
      if (reqId !== requestIdRef.current) return;
      if (j.ok) {
        const incoming = dedupeByPath(j.results ?? []);
        setItems((prev) => dedupeByPath([...prev, ...incoming]));
        setHasMore(!!j.hasMore);
        setNextPage(j.nextPage ?? null);
        setCurrentPage(nextPage);
      }
    } catch {
      // swallow — user can keep scrolling and we'll try again on the next pass
    } finally {
      if (reqId === requestIdRef.current) setLoadingMore(false);
    }
  }, [q, type, hasMore, loadingMore, nextPage]);

  useEffect(() => {
    if (!sentinelRef.current) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loadingMore) {
          loadMore();
        }
      },
      { rootMargin: "600px 0px" }
    );
    obs.observe(sentinelRef.current);
    return () => obs.disconnect();
  }, [hasMore, loadingMore, loadMore]);

  function updateUrl(next: { q?: string; type?: Tab }) {
    const params = new URLSearchParams(searchParams.toString());
    if (next.q != null) {
      if (next.q) params.set("q", next.q);
      else params.delete("q");
    }
    if (next.type != null) {
      if (next.type === "all") params.delete("type");
      else params.set("type", next.type);
    }
    const qs = params.toString();
    startTransition(() => {
      router.push(qs ? `/search?${qs}` : "/search");
    });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    updateUrl({ q });
  }

  function handleTab(t: Tab) {
    if (t === type) return;
    setType(t);
    updateUrl({ type: t });
  }

  const tabCount = (() => {
    if (totalCount == null) return null;
    return totalCount.toLocaleString();
  })();

  return (
    <>
      {/* Big search input on the page (the header SearchBar is for typeahead) */}
      <form onSubmit={handleSubmit} className="mb-6">
        <div className="relative">
          <SearchIcon className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-text-muted" />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search for movies, TV shows…"
            className="w-full rounded-xl border border-border bg-surface/60 py-3.5 pl-12 pr-4 text-base text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none"
            autoFocus
            spellCheck={false}
            autoComplete="off"
          />
        </div>
      </form>

      {/* Filter tabs — match boxmovies's pill style */}
      <div className="no-scrollbar -mx-4 mb-6 flex gap-2 overflow-x-auto px-4">
        {TABS.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => handleTab(t.id)}
              className={cn(
                "flex shrink-0 items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-colors",
                type === t.id
                  ? "border-accent bg-accent text-cream shadow-[0_0_0_1px_rgba(0,0,0,0.05)]"
                  : "border-border bg-surface/40 text-text-secondary hover:border-accent/60 hover:text-cream"
              )}
            >
              <Icon className="h-4 w-4" />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Results header — "12,345 results · Movies" */}
      {!loading && !error && items.length > 0 && totalCount != null && (
        <div className="mb-4 flex items-center justify-between text-sm text-text-muted">
          <div>
            <span className="text-cream font-medium">{totalCount.toLocaleString()}</span>{" "}
            result{totalCount !== 1 ? "s" : ""}
            {type !== "all" && (
              <span> · {type === "movie" ? "Movies" : "TV Shows"}</span>
            )}
          </div>
          {tabCount != null && (
            <div className="hidden text-xs uppercase tracking-wider sm:block">
              Page {currentPage}
            </div>
          )}
        </div>
      )}

      {/* Loading skeleton (first load) */}
      {loading ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="aspect-[2/3] w-full rounded-lg" />
              <Skeleton className="h-3 w-3/4" />
              <Skeleton className="h-7 w-full rounded-md" />
            </div>
          ))}
        </div>
      ) : !q.trim() ? (
        <EmptyState
          icon={<SearchIcon className="h-10 w-10" />}
          title="Start typing to search"
          hint="Try a movie title or TV show."
        />
      ) : error ? (
        <EmptyState
          icon={<SearchIcon className="h-10 w-10" />}
          title="Search failed"
          hint={error}
          tone="error"
        />
      ) : items.length === 0 ? (
        <EmptyState
          icon={<SearchIcon className="h-10 w-10" />}
          title="No results found"
          hint="Try a different search term."
        />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
            {items.map((c) => (
              <SearchResultCard key={`${c.type}-${c.detailPath}`} card={c} />
            ))}
          </div>

          {/* Infinite-scroll sentinel */}
          <div ref={sentinelRef} className="h-px w-full" aria-hidden />

          {loadingMore && (
            <div className="mt-6 flex items-center justify-center py-4 text-sm text-text-muted">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Loading more…
            </div>
          )}

          {!hasMore && items.length > 0 && !loadingMore && (
            <div className="mt-8 text-center text-xs uppercase tracking-wider text-text-muted">
              End of results
            </div>
          )}

          {hasMore && !loadingMore && (
            <div className="mt-6 text-center">
              <button
                type="button"
                onClick={loadMore}
                className="rounded-full border border-border bg-surface/40 px-5 py-2 text-sm font-medium text-text-secondary transition-colors hover:border-accent/60 hover:text-cream"
              >
                Load more
              </button>
            </div>
          )}
        </>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Result card — matches our existing MovieCard style (golden star rating,
// burgundy "Watch now" button) but with the richer h5-api data we get from
// real search (poster is full CDN URL, no `imageUrl()` translation needed).
// ---------------------------------------------------------------------------

function SearchResultCard({ card }: { card: BoxMediaCard }) {
  const watchHref =
    card.type === "tv"
      ? `/watch/tv/${card.detailPath}?s=1&e=1`
      : `/watch/movie/${card.detailPath}`;
  const detailHref =
    card.type === "tv" ? `/tv/${card.detailPath}` : `/movie/${card.detailPath}`;

  const hasRating = card.rating != null && card.rating > 0;

  return (
    <div className="group relative flex flex-col">
      <Link href={detailHref} className="block">
        <div className="relative aspect-[2/3] overflow-hidden rounded-lg bg-surface-elevated">
          {card.posterUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={card.posterUrl ?? undefined}
              alt={card.title}
              loading="lazy"
              referrerPolicy="no-referrer"
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-surface to-bg-primary text-text-muted">
              <SearchIcon className="h-8 w-8" />
            </div>
          )}
          {hasRating && (
            <div className="absolute right-1.5 top-1.5 flex items-center gap-1 rounded-md bg-bg-primary/80 px-1.5 py-0.5 text-[10px] font-semibold text-yellow-400 backdrop-blur-sm sm:text-[11px]">
              <span aria-hidden>★</span>
              {card.rating!.toFixed(1)}
            </div>
          )}
        </div>
      </Link>
      <div className="mt-2 space-y-1.5">
        <Link href={detailHref}>
          <h3 className="line-clamp-1 text-sm font-medium text-cream transition-colors group-hover:text-accent">
            {card.title}
          </h3>
        </Link>
        <Link
          href={watchHref}
          className="inline-flex w-full items-center justify-center rounded-md bg-accent px-3 py-1.5 text-xs font-semibold text-cream transition-colors hover:bg-accent-hover"
        >
          Watch now
        </Link>
      </div>
    </div>
  );
}

function EmptyState({
  icon,
  title,
  hint,
  tone = "default",
}: {
  icon: React.ReactNode;
  title: string;
  hint: string;
  tone?: "default" | "error";
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-2xl border border-dashed py-20 text-center",
        tone === "error"
          ? "border-accent/30 bg-accent/5"
          : "border-border bg-surface/30"
      )}
    >
      <div className="text-text-muted">{icon}</div>
      <p className="mt-3 font-display text-base text-cream">{title}</p>
      <p className="mt-1 max-w-md text-sm text-text-muted">{hint}</p>
    </div>
  );
}

function dedupeByPath(items: BoxMediaCard[]): BoxMediaCard[] {
  const seen = new Set<string>();
  const out: BoxMediaCard[] = [];
  for (const it of items) {
    if (!it || !it.detailPath) continue;
    // type-prefixed key — same detailPath with different type is a real different row
    const key = `${it.type}::${it.detailPath}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(it);
  }
  return out;
}
