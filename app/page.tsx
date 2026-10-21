import { HeroCarousel } from "@/components/home/HeroCarousel";
import { MovieRow } from "@/components/home/MovieRow";
import { PromoBanner } from "@/components/home/PromoBanner";
import { FeatureFooter } from "@/components/home/FeatureFooter";
import { ContinueWatchingRow } from "@/components/home/ContinueWatchingRow";
import { getBoxmoviesHome } from "@/lib/data";
import type { MediaCard, BoxMediaCard } from "@/lib/types";

export const revalidate = 1800; // 30 min

function toMediaCard(c: BoxMediaCard): MediaCard {
  return {
    id: c.detailPath,
    type: c.type,
    title: c.title,
    year: c.year?.toString() ?? "",
    rating: c.rating ?? 0,
    posterPath: c.posterUrl,
    backdropPath: c.backdropUrl,
    overview: c.overview,
  };
}

// Boxmovies' home page has a few "tab" carousels at the top (Home, TV show,
// Movie, Animation, Novel, Most Watched, Boxmovies App, FM Download, Games)
// that all render the same top picks. We skip them and keep the real
// themed rows below.
const SKIP_SECTION_TITLES = new Set([
  "Home",
  "TV show",
  "TV Show",
  "Movie",
  "Movies",
  "Animation",
  "Novel",
  "Most Watched",
  "Boxmovies App",
  "FM Download",
  "Games",
  "Boxmovies",
]);

export default async function HomePage() {
  const home = await getBoxmoviesHome().catch(() => ({
    sections: [],
    hero: [],
    count: 0,
  }));

  const hero: MediaCard[] = home.hero.map(toMediaCard);

  // Filter + dedupe sections
  const seenItemSets = new Set<string>();
  const sections: Array<{ title: string; items: MediaCard[]; key: string }> = [];
  for (const s of home.sections) {
    if (SKIP_SECTION_TITLES.has(s.title)) continue;
    if (!s.items?.length) continue;
    const fp = s.items
      .slice(0, 6)
      .map((i) => i.detailPath)
      .sort()
      .join("|");
    if (seenItemSets.has(fp)) continue;
    seenItemSets.add(fp);
    sections.push({
      title: s.title,
      items: s.items.map(toMediaCard),
      key: `${s.title}-${fp.slice(0, 16)}`,
    });
  }

  return (
    <div className="bg-bg-deepest">
      {/* Hero */}
      <HeroCarousel items={hero} />

      {/* Continue Watching — only shows if the user has history.
          Reads from localStorage; SSR returns nothing (avoids
          hydration mismatch). */}
      <ContinueWatchingRow />

      {/* Promo banner + features just under the hero */}
      <div className="pt-6">
        <PromoBanner />
      </div>
      <div className="pt-3">
        <FeatureFooter />
      </div>

      {/* Themed sections.

          The sponsored card row goes after the THIRD row, not at the foot
          of the page. Bottom-of-page inventory is below the fold on most
          screens and after the visitor has already decided what to watch,
          so it converts worse; mid-feed it sits among content that is
          still being scrolled, styled as one more movie row. */}
      {sections.map((section, i) => (
        <div key={section.key}>
          <section className="mx-auto max-w-7xl px-4 pt-8 md:px-6 md:pt-10 lg:px-8">
            <MovieRow title={section.title} items={section.items} />
          </section>
        </div>
      ))}
    </div>
  );
}
