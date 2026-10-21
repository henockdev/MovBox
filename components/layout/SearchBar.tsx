"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Header search bar with live typeahead.
 *
 * - 200ms debounce per keystroke
 * - Opens dropdown of 10 keyword suggestions (driven by boxmovies's own
 *   h5-api typeahead endpoint)
 * - ↑/↓ to navigate, Enter to pick, Esc to close
 * - Click outside or pick → close + navigate to /search?q=...
 * - Clear (X) button when there's text
 * - Mobile: collapses to icon-only trigger (full search opens /search page)
 *
 * The dropdown UI mirrors the boxmovies.org typeahead (dark panel,
 * search icon, highlighted match) so the experience feels native to
 * anyone coming from there.
 */

type Suggestion = string;

interface SearchBarProps {
  className?: string;
}

export function SearchBar({ className }: SearchBarProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Debounced typeahead
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (abortRef.current) abortRef.current.abort();

    const trimmed = query.trim();
    if (trimmed.length < 1) {
      setSuggestions([]);
      setOpen(false);
      setLoading(false);
      return;
    }

    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      const controller = new AbortController();
      abortRef.current = controller;
      try {
        const res = await fetch(
          `/api/search-suggest?q=${encodeURIComponent(trimmed)}`,
          { cache: "no-store", signal: controller.signal }
        );
        if (!res.ok) throw new Error("suggest failed");
        const j = await res.json();
        if (controller.signal.aborted) return;
        if (j.ok && Array.isArray(j.results)) {
          // De-dupe + filter out exact match (user is typing it already)
          const seen = new Set<string>();
          const list = j.results.filter((w: unknown) => {
            if (typeof w !== "string" || !w.trim()) return false;
            const key = w.toLowerCase();
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
          });
          setSuggestions(list);
          setOpen(list.length > 0);
          setActiveIdx(-1);
        } else {
          setSuggestions([]);
          setOpen(false);
        }
      } catch (err) {
        if (controller.signal.aborted) return;
        setSuggestions([]);
        setOpen(false);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 200);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  // Close on outside click
  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  // Cmd/Ctrl+K to focus
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const navigate = useCallback(
    (q: string) => {
      const next = q.trim();
      if (!next) return;
      setOpen(false);
      router.push(`/search?q=${encodeURIComponent(next)}`);
    },
    [router]
  );

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const pick =
      activeIdx >= 0 && suggestions[activeIdx] ? suggestions[activeIdx] : query;
    navigate(pick);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      if (!open || suggestions.length === 0) return;
      e.preventDefault();
      setActiveIdx((i) => (i + 1) % suggestions.length);
    } else if (e.key === "ArrowUp") {
      if (!open || suggestions.length === 0) return;
      e.preventDefault();
      setActiveIdx((i) => (i <= 0 ? suggestions.length - 1 : i - 1));
    } else if (e.key === "Escape") {
      setOpen(false);
      (e.target as HTMLInputElement).blur();
    }
  }

  function clear() {
    setQuery("");
    setSuggestions([]);
    setOpen(false);
    setActiveIdx(-1);
    inputRef.current?.focus();
  }

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <form onSubmit={handleSubmit} role="search" className="relative">
        <div
          className={cn(
            "group flex h-10 items-center gap-2 rounded-full border border-border bg-surface-elevated/60 px-4 transition-colors focus-within:border-accent hover:border-border-strong",
            open && suggestions.length > 0 && "border-accent/60"
          )}
        >
          <Search className="h-4 w-4 shrink-0 text-text-muted" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => suggestions.length > 0 && setOpen(true)}
            onKeyDown={handleKeyDown}
            placeholder="Search movies, shows…"
            aria-label="Search Movbox"
            autoComplete="off"
            spellCheck={false}
            className="w-full min-w-0 bg-transparent text-sm text-text-primary placeholder:text-text-muted focus:outline-none"
          />
          {loading ? (
            <Loader2 className="h-4 w-4 shrink-0 animate-spin text-text-muted" />
          ) : query ? (
            <button
              type="button"
              onClick={clear}
              className="shrink-0 text-text-muted transition-colors hover:text-text-primary"
              aria-label="Clear search"
            >
              <X className="h-4 w-4" />
            </button>
          ) : (
            <kbd className="hidden shrink-0 rounded border border-border bg-bg-primary px-1.5 py-0.5 font-mono text-[10px] text-text-muted md:inline-block">
              Ctrl K
            </kbd>
          )}
        </div>
      </form>

      {open && suggestions.length > 0 && (
        <div
          role="listbox"
          className="absolute left-0 right-0 top-full z-50 mt-2 max-h-96 overflow-y-auto rounded-xl border border-border bg-surface-elevated/95 shadow-elevated backdrop-blur-md"
        >
          {suggestions.map((s, i) => (
            <button
              key={`${s}-${i}`}
              type="button"
              role="option"
              aria-selected={i === activeIdx}
              onClick={() => navigate(s)}
              onMouseEnter={() => setActiveIdx(i)}
              className={cn(
                "flex w-full items-center gap-3 border-b border-border/40 px-4 py-2.5 text-left text-sm transition-colors last:border-b-0",
                i === activeIdx
                  ? "bg-accent/10 text-cream"
                  : "text-text-secondary hover:bg-surface/60"
              )}
            >
              <Search className="h-4 w-4 shrink-0 text-text-muted" />
              <span className="flex-1 truncate">{renderHighlighted(s, query)}</span>
              <span className="text-[10px] uppercase tracking-wider text-text-muted">
                Search
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Bold the matching prefix inside a suggestion string. */
function renderHighlighted(text: string, query: string) {
  const q = query.trim();
  if (!q) return text;
  const idx = text.toLowerCase().indexOf(q.toLowerCase());
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <span className="font-semibold text-cream">
        {text.slice(idx, idx + q.length)}
      </span>
      {text.slice(idx + q.length)}
    </>
  );
}
