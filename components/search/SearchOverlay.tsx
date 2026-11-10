"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Flame,
  Loader2,
  Play,
  Search,
  Sparkles,
  TrendingUp,
  X,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { SearchChip } from "./SearchChip";
import { SearchResultRow } from "./SearchResultRow";
import { SearchSectionHeader } from "./SearchSectionHeader";
import { imageUrl } from "@/lib/image";
import { SEARCH_TABS, genreList, type SearchCard, type SearchTabId } from "@/lib/search";
import { cn } from "@/lib/utils";

/**
 * The search screen, as a panel that pops over the page.
 *
 * The app's search is a full screen, not a dropdown: a field with the
 * *Search* action inside it, the visitor's recent terms, the catalogue's
 * trending terms, the catalogue tabs and the ranked titles. On the web that
 * screen was a page you had to travel to, so the header's search field did
 * its own small dropdown instead and the app's screen was never really
 * seen.
 *
 * This is that screen, and it opens the moment the header's field is
 * touched.
 *
 * ## The suggestions
 *
 * The upstream's own typeahead answers with **words only** — measured on
 * 2026-11-09, every one of 120 sampled suggestions came back as
 * `{ type: 0, word: "…", subject: null }`, so there is no artwork to show.
 *
 * So the panel does not pretend: it asks the catalogue for the titles that
 * really match what has been typed and renders **those** as full rows with
 * poster, score, year, country and genre — the same rows the results screen
 * uses — and puts the upstream's word completions underneath them, where
 * they belong. Everything on the panel is a real title from the catalogue.
 */

const RECENT_KEY = "movbox.recentSearches";
const RECENT_MAX = 8;
const DEBOUNCE_MS = 280;

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
  try {
    window.localStorage.setItem(RECENT_KEY, JSON.stringify(terms));
  } catch {
    /* private mode */
  }
}

export interface SearchOverlayProps {
  open: boolean;
  onClose: () => void;
  /** The term the panel opens with, if any. */
  initialQuery?: string;
}

export function SearchOverlay({ open, onClose, initialQuery = "" }: SearchOverlayProps) {
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery);
  const [tab, setTab] = useState<SearchTabId>("all");
  const [words, setWords] = useState<string[]>([]);
  const [results, setResults] = useState<SearchCard[]>([]);
  const [ranked, setRanked] = useState<SearchCard[]>([]);
  const [trending, setTrending] = useState<string[]>([]);
  const [recent, setRecent] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [landingLoaded, setLandingLoaded] = useState(false);

  const inputRef = useRef<HTMLInputElement | null>(null);
  const requestRef = useRef(0);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // ---- open / close -------------------------------------------------------

  useEffect(() => {
    if (!open) return;
    setQuery(initialQuery);
    setRecent(readRecent());
    setLandingLoaded(false);
    // Focus after the panel has painted, so the caret lands in the field.
    const id = window.setTimeout(() => inputRef.current?.focus(), 40);
    return () => window.clearTimeout(id);
  }, [open, initialQuery]);

  // Lock the page behind the panel.
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  // Escape closes.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // ---- the landing state --------------------------------------------------

  const loadLanding = useCallback(async () => {
    try {
      const res = await fetch(`/api/search-landing?tab=${tab}`, {
        headers: { Accept: "application/json" },
      });
      const j = await res.json();
      if (!j?.ok) return;
      setRanked(Array.isArray(j.ranked) ? j.ranked : []);
      setTrending(Array.isArray(j.trending) ? j.trending : []);
    } catch {
      /* the panel still works without the landing state */
    } finally {
      setLandingLoaded(true);
    }
  }, [tab]);

  useEffect(() => {
    if (!open) return;
    loadLanding();
  }, [open, loadLanding]);

  // ---- live suggestions + top results -------------------------------------

  useEffect(() => {
    const keyword = query.trim();
    if (keyword.length < 2) {
      setWords([]);
      setResults([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    const id = ++requestRef.current;
    setLoading(true);

    const timer = window.setTimeout(async () => {
      try {
        const [sugRes, hitRes] = await Promise.all([
          fetch(`/api/search-suggest?q=${encodeURIComponent(keyword)}`, {
            headers: { Accept: "application/json" },
          }),
          fetch(
            `/api/search?q=${encodeURIComponent(keyword)}&tab=${tab}&perPage=10`,
            { headers: { Accept: "application/json" } }
          ),
        ]);
        const sug = await sugRes.json();
        const hits = await hitRes.json();
        if (cancelled || id !== requestRef.current) return;

        setWords(
          Array.isArray(sug?.suggestions)
            ? sug.suggestions
                .filter((w: unknown): w is string => typeof w === "string")
                .slice(0, 14)
            : []
        );
        setResults(Array.isArray(hits?.items) ? hits.items : []);
      } catch {
        if (cancelled || id !== requestRef.current) return;
        setWords([]);
        setResults([]);
      } finally {
        if (!cancelled && id === requestRef.current) setLoading(false);
      }
    }, DEBOUNCE_MS);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [query, tab]);

  // ---- actions ------------------------------------------------------------

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

  const seeAll = useCallback(() => {
    const keyword = query.trim();
    if (!keyword) return;
    remember(keyword);
    router.push(`/search?q=${encodeURIComponent(keyword)}&tab=${tab}`);
    onClose();
  }, [query, tab, router, onClose, remember]);

  const pickWord = useCallback(
    (word: string) => {
      setQuery(word);
      remember(word);
      inputRef.current?.focus();
    },
    [remember]
  );

  const isTyping = query.trim().length >= 2;
  const feature = results[0];
  const rest = results.slice(1);

  if (!open) return null;

  return (
    <div
      className="search-pop fixed inset-0 z-[130] overflow-y-auto overscroll-contain bg-bg-deepest"
      role="dialog"
      aria-modal="true"
      aria-label="Search Movbox"
    >
      {/* ---- the top bar ---- */}
      <div className="sticky top-0 z-20 border-b border-border bg-bg-deepest/92 backdrop-blur-xl">
        <div className="mx-auto flex h-[68px] max-w-4xl items-center gap-2 px-3 sm:gap-3 sm:px-5">
          <button
            type="button"
            onClick={onClose}
            aria-label="Close search"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-text-secondary transition hover:bg-surface-hover hover:text-cream"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>

          <div className="flex h-12 min-w-0 flex-1 items-center gap-2.5 rounded-full border border-border bg-surface-elevated pl-4 pr-1.5 transition-all duration-300 focus-within:border-accent focus-within:shadow-glow sm:h-[54px] sm:pl-5">
            <Search className="h-[18px] w-[18px] shrink-0 text-text-secondary" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  seeAll();
                }
              }}
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
                  setWords([]);
                  setResults([]);
                  inputRef.current?.focus();
                }}
                aria-label="Clear the search field"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-text-muted transition hover:bg-surface-hover hover:text-cream"
              >
                <X className="h-4 w-4" />
              </button>
            ) : null}
            <button
              type="button"
              onClick={seeAll}
              disabled={!query.trim()}
              className="h-9 shrink-0 rounded-full bg-brand px-4 text-[13px] font-bold text-cream transition-all duration-200 hover:bg-accent hover:shadow-glow disabled:cursor-default disabled:opacity-40 sm:px-5"
            >
              Search
            </button>
          </div>
        </div>
      </div>

      {/* ---- the body ---- */}
      <div
        ref={scrollRef}
        className="mx-auto max-w-4xl px-4 pb-28 pt-5 sm:px-6"
      >
        {/* the catalogue tabs */}
        <div
          role="tablist"
          aria-label="Catalogue"
          className="no-scrollbar flex items-center gap-1 overflow-x-auto border-b border-border"
        >
          {SEARCH_TABS.map((t) => {
            const on = t.id === tab;
            return (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={on}
                onClick={() => setTab(t.id)}
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

        {/* ---- the live screen ---- */}
        {isTyping ? (
          <>
            {loading && !results.length ? (
              <div className="flex items-center justify-center gap-2 py-16 text-text-muted">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm">Searching…</span>
              </div>
            ) : null}

            {feature ? (
              <>
                <SearchSectionHeader title="Top result" count={results.length} />
                <FeatureCard card={feature} />
              </>
            ) : null}

            {rest.length ? (
              <>
                <SearchSectionHeader title="More like this" />
                <div className="flex flex-col">
                  {rest.map((card, i) => (
                    <SearchResultRow
                      key={`${card.id}-${i}`}
                      card={card}
                      rank={i + 2}
                    />
                  ))}
                </div>
              </>
            ) : null}

            {!loading && !results.length ? (
              <div className="flex flex-col items-center gap-3 py-14 text-center">
                <Sparkles className="h-7 w-7 text-text-muted" />
                <p className="text-sm text-text-secondary">
                  Nothing in the catalogue matches “{query.trim()}”.
                </p>
              </div>
            ) : null}

            {words.length ? (
              <>
                <SearchSectionHeader title="Suggestions" />
                <div className="flex flex-wrap gap-2">
                  {words.map((w) => (
                    <SearchChip key={w} text={w} onClick={() => pickWord(w)} />
                  ))}
                </div>
              </>
            ) : null}

            {query.trim() ? (
              <button
                type="button"
                onClick={seeAll}
                className="group mt-7 flex w-full items-center gap-3 rounded-2xl border border-border bg-surface-elevated px-5 py-4 text-left transition-all duration-300 hover:border-accent hover:shadow-glow"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand text-cream shadow-glow">
                  <Search className="h-4.5 w-[18px]" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[14px] font-semibold text-cream">
                    See all results for “{query.trim()}”
                  </span>
                  <span className="mt-0.5 block text-[12px] text-text-muted">
                    Filter by genre, year, country and rating
                  </span>
                </span>
                <ArrowLeft className="h-4 w-4 shrink-0 rotate-180 text-text-muted transition-transform duration-300 group-hover:translate-x-1 group-hover:text-accent-bright" />
              </button>
            ) : null}
          </>
        ) : (
          <>
            {/* ---- the landing state ---- */}
            {recent.length ? (
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
                      onClick={() => {
                        setQuery(term);
                        remember(term);
                      }}
                    />
                  ))}
                </div>
              </>
            ) : null}

            {trending.length ? (
              <>
                <SearchSectionHeader title="🔥 Everyone is searching" />
                <div className="flex flex-wrap gap-2">
                  {trending.map((term) => (
                    <SearchChip
                      key={term}
                      text={term}
                      onClick={() => {
                        setQuery(term);
                        remember(term);
                      }}
                    />
                  ))}
                </div>
              </>
            ) : null}

            {ranked.length ? (
              <>
                <SearchSectionHeader title="Top rankings" />
                <div className="flex flex-col">
                  {ranked.slice(0, 12).map((card, i) => (
                    <SearchResultRow
                      key={`${card.id}-${i}`}
                      card={card}
                      rank={i + 1}
                    />
                  ))}
                </div>
              </>
            ) : null}

            {!landingLoaded ? (
              <div className="flex items-center justify-center gap-2 py-16 text-text-muted">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm">Loading the catalogue…</span>
              </div>
            ) : null}
          </>
        )}
      </div>

      {/* ---- the trending corner mark ---- */}
      <div
        aria-hidden
        className="pointer-events-none fixed bottom-6 right-6 hidden opacity-[0.07] lg:block"
      >
        <Flame className="h-40 w-40 text-accent-bright" />
      </div>
    </div>
  );
}

/**
 * The feature card — the one big, cinematic result at the top of the panel.
 *
 * It is the first real match for what has been typed, shown with its own
 * wide artwork, its score and its meta line, so the panel opens on something
 * that looks like the site rather than like a text box.
 */
function FeatureCard({ card }: { card: SearchCard }) {
  const href =
    card.type === "movie"
      ? `/movie/${encodeURIComponent(card.id)}`
      : `/tv/${encodeURIComponent(card.id)}`;
  const backdrop = imageUrl(card.backdropUrl, "w780");
  const poster = imageUrl(card.posterUrl, "w342");
  const genres = genreList(card).join(", ");

  return (
    <Link
      href={href}
      className="group relative block overflow-hidden rounded-2xl border border-border bg-surface-elevated shadow-elevated transition-all duration-300 hover:border-accent hover:shadow-glow"
    >
      <div className="relative aspect-[16/9] w-full">
        {backdrop ? (
          <Image
            src={backdrop}
            alt=""
            fill
            sizes="(max-width: 900px) 100vw, 720px"
            className="object-cover transition-transform duration-700 group-hover:scale-[1.04]"
          />
        ) : (
          <div
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(135deg, rgba(128,0,32,0.6), rgba(13,9,9,0.95))",
            }}
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-bg-deepest via-bg-deepest/35 to-transparent" />

        {/* the poster, tucked into the corner like the app's hero card */}
        {poster ? (
          <div className="absolute bottom-3 left-3 h-[86px] w-[58px] overflow-hidden rounded-lg border border-border/70 bg-card-burgundy shadow-elevated sm:h-[104px] sm:w-[70px]">
            <Image
              src={poster}
              alt=""
              fill
              sizes="70px"
              className="object-cover"
            />
          </div>
        ) : null}

        <div className="absolute inset-x-0 bottom-0 p-4 pl-[86px] sm:p-5 sm:pl-[100px]">
          <h3 className="line-clamp-2 font-display text-lg font-bold leading-tight text-cream drop-shadow-[0_2px_10px_rgba(0,0,0,0.85)] sm:text-2xl">
            {card.title}
          </h3>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            {card.rating != null && card.rating > 0 ? (
              <span className="inline-flex items-center gap-1 rounded bg-brand px-1.5 py-0.5 text-[10px] font-bold leading-none text-cream">
                <Play className="h-[10px] w-[10px] fill-current" />
                {card.rating.toFixed(1)}
              </span>
            ) : null}
            <span className="text-[11.5px] text-cream/80 sm:text-xs">
              {[card.year ? String(card.year) : "", card.country, genres]
                .filter(Boolean)
                .join(" | ")}
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}
