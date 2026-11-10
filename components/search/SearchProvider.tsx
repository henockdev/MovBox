"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { SearchOverlay } from "./SearchOverlay";

/**
 * The search panel's host.
 *
 * One overlay is mounted for the whole site, so the header's search field
 * can open the app's search screen from any page without the screen having
 * to live on every route.
 *
 * Ctrl/Cmd+K and "/" open it, the way a search-first product should.
 */

interface SearchContextValue {
  open: boolean;
  openSearch: (initialQuery?: string) => void;
  closeSearch: () => void;
}

const SearchContext = createContext<SearchContextValue | null>(null);

export function SearchProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [initialQuery, setInitialQuery] = useState("");

  const openSearch = useCallback((query = "") => {
    setInitialQuery(query);
    setOpen(true);
  }, []);

  const closeSearch = useCallback(() => setOpen(false), []);

  // Ctrl/Cmd+K and "/" open the panel from anywhere.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && open) {
        closeSearch();
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        openSearch();
        return;
      }
      if (e.key === "/" && !e.metaKey && !e.ctrlKey && !e.altKey) {
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
        openSearch();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, openSearch, closeSearch]);

  return (
    <SearchContext.Provider value={{ open, openSearch, closeSearch }}>
      {children}
      <SearchOverlay
        open={open}
        onClose={closeSearch}
        initialQuery={initialQuery}
      />
    </SearchContext.Provider>
  );
}

export function useSearchOverlay(): SearchContextValue {
  const ctx = useContext(SearchContext);
  if (!ctx) {
    throw new Error(
      "useSearchOverlay must be used inside <SearchProvider> — see app/layout.tsx"
    );
  }
  return ctx;
}
