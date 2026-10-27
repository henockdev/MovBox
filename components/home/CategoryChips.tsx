import Link from "next/link";
import { Baby, Clapperboard, Film, Music2, Radio, Sparkles, Sunrise } from "lucide-react";
import { CATEGORIES } from "@/lib/categories";

/**
 * Category chips for the home page.
 *
 * The app's home tab carries far more than the website's six navigation
 * entries, so the extra shelves are surfaced here as a scrollable chip row
 * directly under the hero — the same place the app puts its own category
 * entry points.
 */
const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  kids: Baby,
  asian: Sparkles,
  western: Sunrise,
  nollywood: Clapperboard,
  shorttv: Clapperboard,
  music: Music2,
  midnight: Film,
  live: Radio,
};

export function CategoryChips({ className }: { className?: string }) {
  return (
    <nav
      aria-label="Categories"
      className={`no-scrollbar flex gap-2 overflow-x-auto px-3 sm:gap-3 sm:px-5 md:px-6 lg:px-8 ${className ?? ""}`}
    >
      {CATEGORIES.map((cat) => {
        const Icon = ICONS[cat.slug] ?? Film;
        return (
          <Link
            key={cat.slug}
            href={`/category/${cat.slug}`}
            className="group flex shrink-0 flex-col items-center gap-2 rounded-lg border border-border bg-surface/60 px-4 py-3 transition-all hover:border-accent hover:bg-surface-elevated hover:shadow-glow md:min-w-[88px]"
          >
            <Icon className="h-6 w-6 text-accent-bright transition-transform group-hover:scale-110" />
            <span className="text-xs font-medium text-text-secondary group-hover:text-cream">
              {cat.title}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
