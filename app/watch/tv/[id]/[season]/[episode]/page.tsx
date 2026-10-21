import { redirect } from "next/navigation";

interface PageProps {
  params: Promise<{ id: string; season: string; episode: string }>;
}

/**
 * Legacy URL form: /watch/tv/<id>/<season>/<episode> — kept for
 * back-compat with previously-shared links and the redirect from
 * /watch/tv/<id> with no season/episode. Sends the user to the single
 * stable page at /watch/tv/<id>?s=<season>&e=<episode>.
 *
 * That single page never unmounts when the season/episode change, so
 * the player + season picker keep their state across navigations.
 */
export default async function WatchTVLegacyPage({ params }: PageProps) {
  const { id, season, episode } = await params;
  redirect(
    `/watch/tv/${encodeURIComponent(id)}?s=${encodeURIComponent(season)}&e=${encodeURIComponent(episode)}`
  );
}
