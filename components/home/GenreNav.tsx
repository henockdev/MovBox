import Link from "next/link";
import { GENRE_NAV } from "@/lib/constants";
import { cn } from "@/lib/utils";

/**
 * Horizontal genre chip nav. Matches the design (icon + label per chip).
 * Active state would normally be handled with `usePathname`, but kept simple
 * here — this is a static link list.
 */
export function GenreNav({ className }: { className?: string }) {
  return (
    <nav
      aria-label="Browse by genre"
      className={cn(
        "no-scrollbar flex gap-2 overflow-x-auto px-4 md:gap-3 md:px-6 lg:px-8",
        className
      )}
    >
      {GENRE_NAV.map((g) => {
        const Icon = g.icon;
        return (
          <Link
            key={g.tmdbId}
            href={`/genres/${g.tmdbId}`}
            className="group flex shrink-0 flex-col items-center gap-2 rounded-lg border border-border bg-surface/60 px-4 py-3 transition-all hover:border-accent hover:bg-surface-elevated hover:shadow-glow md:min-w-[88px]"
          >
            <Icon className="h-6 w-6 text-accent-bright transition-transform group-hover:scale-110" />
            <span className="text-xs font-medium text-text-secondary group-hover:text-cream">
              {g.name}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
