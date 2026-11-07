import type { Metadata } from "next";
import { getBoxmoviesRankings, cleanRankingTitle } from "@/lib/data";
import { RankingsView } from "@/components/rankings/RankingsView";
import { BreadcrumbJsonLd } from "@/components/seo/BreadcrumbJsonLd";
import { ItemListJsonLd } from "@/components/seo/ItemListJsonLd";
import { pageSeo } from "@/lib/seo";

export const revalidate = 1800; // 30 min

/**
 * The rankings index.
 *
 * The same page the app shows as its ranking blocks, on one URL. Every other
 * group has its own URL under /rankings/<group>, and this page is the
 * canonical entry point into the whole set — every group is one click away
 * in the sidebar, and every group is linked from the sitemap.
 */
export async function generateMetadata(): Promise<Metadata> {
  return pageSeo({
    path: "/rankings",
    title: "Movbox Rankings — Top Movies & TV Shows, Ranked Daily",
    description:
      "Every Movbox ranking in one place: top K-Drama, Anime, Action, Horror, Romance, Nollywood and more. Ranked by what people are watching and updated daily.",
    image: "/opengraph-image",
    imageWidth: 1200,
    imageHeight: 630,
    keywords: [
      "movbox rankings",
      "top movies",
      "top tv shows",
      "best k-drama",
      "best anime",
    ],
  });
}

export default async function RankingsPage() {
  const groups = await getBoxmoviesRankings().catch(() => []);
  const active = groups[0] ?? null;

  return (
    <>
      <BreadcrumbJsonLd
        items={[
          { name: "Home", path: "/" },
          { name: "Rankings", path: "/rankings" },
        ]}
      />
      {active ? (
        <ItemListJsonLd
          name={`Top ${cleanRankingTitle(active.title)} on Movbox`}
          description={`The most popular ${cleanRankingTitle(active.title).toLowerCase()} titles on Movbox, ranked by how much they are being watched.`}
          items={active.items.slice(0, 20).map((item) => ({
            name: item.title,
            url: `/${item.type}/${encodeURIComponent(item.detailPath)}`,
            image: item.posterUrl,
          }))}
        />
      ) : null}
      <RankingsView groups={groups} activeSlug={active?.slug ?? ""} />
    </>
  );
}
