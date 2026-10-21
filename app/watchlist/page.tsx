import type { Metadata } from "next";
import { WatchlistClient } from "./WatchlistClient";

export const metadata: Metadata = {
  title: "My List — Movbox",
  description: "Your saved movies and TV shows on Movbox.",
};

export default function WatchlistPage() {
  return <WatchlistClient />;
}
