import type { Metadata } from "next";
import Link from "next/link";
import { getBoxmoviesRankings, cleanRankingTitle } from "@/lib/data";
import { RankingsView } from "@/components/rankings/RankingsView";
import { BreadcrumbJsonLd } from "@/components/seo/BreadcrumbJsonLd";
import { ItemListJsonLd } from "@/components/seo/ItemListJsonLd";
import { pageSeo } from "@/lib/seo";

export const revalidate = 1800; // 30 min
export const dynamicParams = true; // a group the upstream adds later is rendered on demand

interface RankingGroupPageProps {
  params: Promise<{ group: string }>;
}

/**
 * Prerender every ranking group at build time.
 *
 * The groups come from the upstream's own list, so they are known before the
 * build starts. Prerendering them makes every group a static, cached URL from
 * the moment it is published — no first-hit render, no cold TTFB for a
 * crawler, and the page is in the sitemap as real HTML rather than a
 * server-rendered-on-demand route.
 *
 * `dynamicParams` stays on, so a group the upstream adds later is rendered on
 * demand instead of 404ing.
 */
export async function generateStaticParams(): Promise<{ group: string }[]> {
  const groups = await getBoxmoviesRankings().catch(() => []);
  return groups.map((g) => ({ group: g.slug }));
}

/**
 * One ranking group.
 *
 * A ranking that lives behind a query string (`/rankings?g=k-drama`) is a
 * dynamic route — it cannot be prerendered and it is never cached, which is
 * exactly what a page that has to be crawled should not be. A path segment
 * keeps every group a real, static, self-canonical URL with its own title,
 * description and ranked structured data.
 */
export async function generateMetadata({
  params,
}: RankingGroupPageProps): Promise<Metadata> {
  const { group } = await params;
  const groups = await getBoxmoviesRankings().catch(() => []);
  const active = groups.find((g) => g.slug === group);
  if (!active) {
    // The upstream drops and renames ranking groups (a slug changed from
    // "trending-short-drma" to "trending-short-drama"), so a URL that is
    // still in an old sitemap can outlive the group. The page answers with
    // a real, indexable-looking heading but is marked noindex, so it never
    // competes with the live group it used to be.
    return pageSeo({
      path: `/rankings/${group}`,
      title: "This ranking is no longer available",
      description:
        "This Movbox ranking is no longer available. Browse every live ranking — movies, series, K-Drama, anime and more — on the Movbox rankings page.",
      noindex: true,
    });
  }

  const n = active.items.length;
  // The upstream ships emoji and brackets in its group names; the metadata
  // gets a cleaned copy, the page body keeps the upstream label.
  const label = cleanRankingTitle(active.title);
  return pageSeo({
    path: `/rankings/${active.slug}`,
    title: `${label} Rankings — Top ${n} on Movbox`,
    description: `The top ${n} ${label.toLowerCase()} titles on Movbox, ranked by what people are watching and updated daily. Watch every one free in HD on any screen.`,
    image: active.items[0]?.posterUrl || "/opengraph-image",
    imageWidth: 1200,
    imageHeight: 630,
    keywords: [
      `best ${label.toLowerCase()}`,
      `top ${label.toLowerCase()}`,
      `${label.toLowerCase()} ranking`,
      "movbox rankings",
    ],
  });
}

export default async function RankingGroupPage({ params }: RankingGroupPageProps) {
  const { group } = await params;
  const groups = await getBoxmoviesRankings().catch(() => []);
  const active = groups.find((g) => g.slug === group);

  // A group the upstream has retired still has to answer with a real page:
  // an empty document (what notFound() produced here) is a soft 404 — it
  // looks like a page with no heading and no metadata to a crawler.
  if (!active) {
    return (
      <div className="mx-auto max-w-3xl px-4 pb-16 pt-24 md:px-6 lg:px-8">
        <h1 className="font-display text-3xl font-bold text-cream md:text-4xl">
          This ranking is no longer available
        </h1>
        <p className="mt-3 max-w-2xl text-text-secondary">
          The upstream renamed or retired this ranking. Every live ranking —
          movies, series, K-Drama, anime and more — is one click away.
        </p>
        <Link
          href="/rankings"
          className="mt-6 inline-block rounded-md bg-accent px-4 py-2 text-sm font-medium text-cream transition-colors hover:bg-accent/80"
        >
          See all rankings
        </Link>
      </div>
    );
  }

  return (
    <>
      <BreadcrumbJsonLd
        items={[
          { name: "Home", path: "/" },
          { name: "Rankings", path: "/rankings" },
          { name: active.title, path: `/rankings/${active.slug}` },
        ]}
      />
      <ItemListJsonLd
        name={`Top ${cleanRankingTitle(active.title)} on Movbox`}
        description={`The most popular ${cleanRankingTitle(active.title).toLowerCase()} titles on Movbox, ranked by how much they are being watched.`}
        items={active.items.slice(0, 30).map((item) => ({
          name: item.title,
          url: `/${item.type}/${encodeURIComponent(item.detailPath)}`,
          image: item.posterUrl,
        }))}
      />
      <RankingsView
        groups={groups}
        activeSlug={active.slug}
        heading={`${cleanRankingTitle(active.title)} Rankings`}
      />
    </>
  );
}
