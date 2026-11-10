"use client";

import { Search } from "lucide-react";
import { useSearchOverlay } from "@/components/search/SearchProvider";
import { cn } from "@/lib/utils";

/**
 * The header's search field.
 *
 * It looks like an input but it is a trigger: touching it opens the app's
 * search screen, which pops over the page.
 *
 * The old version did its own small dropdown in the header — a 200 ms
 * typeahead that navigated to /search. That is a different experience from
 * the app's, where search is a whole screen with the catalogue's ranking, the
 * visitor's recent terms and the trending terms on it. One search screen,
 * opened from anywhere, replaces both.
 */
export function SearchBar({ className }: { className?: string }) {
  const { openSearch } = useSearchOverlay();

  return (
    <button
      type="button"
      onClick={() => openSearch()}
      aria-label="Search Movbox"
      aria-haspopup="dialog"
      className={cn(
        "group flex h-10 w-full items-center gap-2 rounded-full border border-border bg-surface-elevated/60 px-4 text-left transition-colors duration-200 hover:border-border-strong hover:bg-surface-elevated",
        className
      )}
    >
      <Search className="h-4 w-4 shrink-0 text-text-muted transition-colors duration-200 group-hover:text-accent-bright" />
      <span className="w-full min-w-0 truncate text-sm text-text-muted">
        Search movies, shows…
      </span>
      <kbd className="hidden shrink-0 rounded border border-border bg-bg-primary px-1.5 py-0.5 font-mono text-[10px] text-text-muted md:inline-block">
        Ctrl K
      </kbd>
    </button>
  );
}
