import { MovieCard } from "@/components/home/MovieCard";
import type { MediaCard } from "@/lib/types";

/**
 * Responsive grid of media cards for browse / search / list pages.
 * Fills the parent — items wrap automatically.
 */
export function MediaGrid({
  items,
  emptyMessage = "No results found.",
}: {
  items: MediaCard[];
  emptyMessage?: string;
}) {
  if (!items.length) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-border bg-surface/30 px-6 py-20 text-center">
        <p className="text-base text-text-secondary md:text-lg">{emptyMessage}</p>
        <p className="mt-2 text-sm text-text-muted">
          Try adjusting your filters or search terms.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 md:gap-4">
      {items.map((media, i) => (
        <MovieCard
          key={`${media.type}-${media.id}`}
          media={media}
          priority={i < 6}
        />
      ))}
    </div>
  );
}
