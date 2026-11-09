import { getBoxmoviesRankings } from "@/lib/data";
import { selectRankingGroups, toShelfGroups } from "@/lib/ranking-shelf";
import { RankingShelf } from "./RankingShelf";

/**
 * The ranking block, server-rendered.
 *
 * The app has a ranking block on every tab. This resolves the groups for one
 * screen and hands the shelf a compact payload — the full group lives on its
 * own `/rankings/<group>` page.
 *
 * A failed upstream call renders nothing at all: a browse page must never
 * break because a ranking list could not be loaded.
 */
export async function RankingShelfSection({
  kind,
  title,
  className,
}: {
  kind: "movie" | "tv" | "anime";
  title?: string;
  className?: string;
}) {
  const groups = await getBoxmoviesRankings().catch(() => []);
  const selected = selectRankingGroups(groups, kind, 10);
  if (!selected.length) return null;

  return (
    <RankingShelf
      groups={toShelfGroups(selected, 12)}
      title={title}
      className={className}
    />
  );
}
