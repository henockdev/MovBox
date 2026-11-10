"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import { Logo } from "./Logo";
import { SearchBar } from "./SearchBar";
import { AuthButton } from "./AuthButton";
import { CategoriesMenu } from "./CategoriesMenu";
import { useSearchOverlay } from "@/components/search/SearchProvider";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/", label: "Home" },
  // The app's Trending tab and its ranking blocks. Both were app-only until
  // now — they are the two entry points a visitor uses to find something to
  // watch without searching, so they belong in the top bar.
  { href: "/trending", label: "Trending" },
  { href: "/rankings", label: "Rankings" },
  { href: "/movies", label: "Movies" },
  { href: "/tv", label: "TV Shows" },
  { href: "/animations", label: "Animations" },
  { href: "/most-watched", label: "Most Watched" },
  { href: "/movbox-app", label: "Movbox App" },
];

/**
 * Sticky header. Transparent at the top, glass-frosted after the user scrolls.
 * On scroll, swaps the home link label from "Home" to the brand mark (handled
 * in CSS via the data attribute set on scroll).
 */
export function Header() {
  const pathname = usePathname();
  const { openSearch } = useSearchOverlay();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    function onScroll() {
      setScrolled(window.scrollY > 24);
    }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      data-scrolled={scrolled}
      className={cn(
        "fixed inset-x-0 top-0 z-50 transition-colors duration-300",
        scrolled
          ? "glass border-b border-border"
          : "bg-gradient-to-b from-bg-deepest/80 to-transparent"
      )}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-5 px-3 sm:px-5 md:px-6 lg:px-8">
        <Logo size="md" className="shrink-0" />

        <nav className="hidden items-center gap-0.5 md:flex">
          {NAV.map((item) => {
            const active =
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "rounded-md px-2.5 py-1.5 text-[13px] font-medium transition-colors",
                  active
                    ? "text-accent-bright"
                    : "text-text-secondary hover:text-text-primary"
                )}
              >
                {item.label}
              </Link>
            );
          })}
          <CategoriesMenu />
        </nav>

        <div className="ml-auto flex items-center gap-1.5 md:gap-2.5">
          <SearchBar className="hidden w-56 lg:flex" />
          {/* Below the large breakpoint the field is hidden, so the same
              search screen gets its own icon — otherwise a phone had no way
              into search at all. */}
          <button
            type="button"
            onClick={() => openSearch()}
            aria-label="Search Movbox"
            aria-haspopup="dialog"
            className="flex h-10 w-10 items-center justify-center rounded-full text-text-secondary transition-colors duration-200 hover:bg-surface-elevated hover:text-cream lg:hidden"
          >
            <Search className="h-[18px] w-[18px]" />
          </button>
          <AuthButton />
        </div>
      </div>
    </header>
  );
}
