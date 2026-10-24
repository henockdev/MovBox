import type { Metadata } from "next";
import { WatchlistClient } from "./WatchlistClient";
import { pageSeo } from "@/lib/seo";

export const metadata: Metadata = pageSeo({
  path: "/watchlist",
  title: "My List",
  description: "Your saved movies and TV shows on Movbox.",
  noindex: true,
});

export default function WatchlistPage() {
  return <WatchlistClient />;
}
