import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { MovieRow } from "@/components/home/MovieRow";
import { BreadcrumbJsonLd } from "@/components/seo/BreadcrumbJsonLd";
import { getBoxmoviesBrowse, getBoxmoviesOperatingTab } from "@/lib/data";
import { toMediaCards } from "@/lib/cards";
import { CATEGORIES, CATEGORY_BY_SLUG } from "@/lib/categories";
import { pageSeo } from "@/lib/seo";
import type { MediaCard } from "@/lib/types";

export const revalidate = 1800; // 30 min

interface PageProps {
  params: Promise<{ slug: string }>;
}

export function generateStaticParams() {
  return CATEGORIES.map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const cat = CATEGORY_BY_SLUG.get(slug);
  if (!cat) {
    return pageSeo({
      path: `/category/${slug}`,
      title: "Category not found",
      description: "This category does not exist on Movbox.",
      noindex: true,
    });
  }
  return pageSeo({
    path: `/category/${cat.slug}`,
    title: cat.title,
    description: cat.description,
    keywords: cat.keywords,
  });
}

/**
 * One category page.
 *
 * The original app reaches its category tabs through the mobile BFF, which
 * this deployment cannot call, so the sections are rebuilt from the web
 * BFF's own channel + filter vocabulary. Every source is verified to return
 * real, on-topic titles — a category that could not be filled is not
 * shipped.
 */
export default async function CategoryPage({ params }: PageProps) {
  const { slug } = await params;
  const cat = CATEGORY_BY_SLUG.get(slug);
  if (!cat) notFound();

  // Resolve every section in parallel. One slow source must not hold up the
  // rest of the page.
  const resolved = await Promise.all(
    cat.sources.map(async (source) => {
      try {
        if (source.kind === "operating") {
          const sections = await getBoxmoviesOperatingTab(source.tabId);
          return sections.map((s) => ({
            title: s.title,
            items: toMediaCards(s.items) as MediaCard[],
          }));
        }
        const browse = await getBoxmoviesBrowse(source.channelId, {
          ...source.filters,
          perPage: 20,
          sort: "ForYou",
        });
        return [
          {
            title: source.title,
            items: toMediaCards(browse.items) as MediaCard[],
          },
        ];
      } catch {
        return [];
      }
    })
  );

  const sections = resolved.flat().filter((s) => s.items.length > 0);

  return (
    <div className="min-h-screen pb-16 pt-16 md:pb-12 md:pt-20">
      <BreadcrumbJsonLd
        items={[
          { name: "Home", path: "/" },
          { name: cat.title, path: `/category/${cat.slug}` },
        ]}
      />

      <div className="mx-auto w-full max-w-[1500px] px-3 sm:px-5 md:px-6">
        <header className="mb-4 sm:mb-6 md:mb-8">
          <h1 className="font-display text-2xl font-bold text-cream sm:text-3xl md:text-4xl">
            {cat.title}
          </h1>
          <p className="mt-1 max-w-2xl text-xs text-text-secondary sm:text-sm md:text-base">
            {cat.tagline}
          </p>
        </header>

        {cat.externalHub && (
          <a
            href={cat.externalHub.url}
            target="_blank"
            rel="noopener noreferrer"
            className="mb-6 flex items-center justify-between gap-4 rounded-xl border border-border bg-surface-elevated p-4 transition-colors hover:border-accent sm:p-5"
          >
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-cream sm:text-base">
                {cat.externalHub.label}
              </span>
              <span className="mt-1 block text-xs text-text-secondary">
                {cat.externalHub.note}
              </span>
            </span>
            <ArrowUpRight className="h-5 w-5 shrink-0 text-accent-bright" />
          </a>
        )}

        {sections.length === 0 ? (
          <p className="py-10 text-center text-sm text-text-secondary">
            Nothing to show here yet — check back soon.
          </p>
        ) : (
          <div className="flex flex-col gap-8 sm:gap-10">
            {sections.map((section) => (
              <MovieRow
                key={section.title}
                title={section.title}
                items={section.items}
              />
            ))}
          </div>
        )}

        <nav
          aria-label="Other categories"
          className="mt-10 border-t border-border pt-6 sm:mt-12"
        >
          <h2 className="mb-3 text-sm font-semibold text-cream">
            Browse other categories
          </h2>
          <ul className="flex flex-wrap gap-2">
            {CATEGORIES.filter((c) => c.slug !== cat.slug).map((c) => (
              <li key={c.slug}>
                <Link
                  href={`/category/${c.slug}`}
                  className="inline-block rounded-full border border-border px-3 py-1.5 text-xs text-text-secondary transition-colors hover:border-accent hover:text-cream"
                >
                  {c.title}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </div>
  );
}
