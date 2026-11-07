import type { Metadata } from "next";
import { notFound } from "next/navigation";
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
    return pageSeo({
      path: "/rankings",
      title: "Movbox Rankings — Top Movies & TV Shows, Ranked Daily",
      description:
        "Every Movbox ranking in one place: top K-Drama, Anime, Action, Horror, Romance, Nollywood and more. Ranked by what people are watching and updated daily.",
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
    image: active.items[0]?.posterUrl ?? "/opengraph-image",
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
  if (!active) notFound();

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
