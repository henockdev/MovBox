import Link from "next/link";
import { SITE_NAME } from "@/lib/constants";

/**
 * The page shown when a title could not be loaded because the catalogue
 * service refused the call.
 *
 * This is NOT the same as "the title does not exist". The upstream
 * rate-limits, and a crawler walking the sitemap is exactly the traffic
 * that trips the limit — so the answer to a rate-limited lookup must never
 * be a 404 or an empty document. The title comes from the detail path
 * (which is the title the catalogue itself minted), the page has a real
 * heading, and the links lead somewhere useful.
 */
export function DetailUnavailable({
  title,
  kind = "movie",
}: {
  /** The title, derived from the detail path. */
  title: string;
  kind?: "movie" | "tv";
}) {
  return (
    <div className="mx-auto max-w-3xl px-4 pb-16 pt-24 md:px-6 lg:px-8">
      <h1 className="font-display text-3xl font-bold text-cream md:text-4xl">
        {title}
      </h1>
      <p className="mt-3 max-w-2xl text-text-secondary">
        The catalogue service is busy right now, so this title could not be
        loaded. Give it a moment and reload — {title} is still on {SITE_NAME}.
      </p>
      <div className="mt-6 flex flex-wrap gap-3">
        <Link
          href={kind === "tv" ? "/tv" : "/movies"}
          className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-cream transition-colors hover:bg-accent/80"
        >
          Browse {kind === "tv" ? "TV shows" : "movies"}
        </Link>
        <Link
          href="/search"
          className="rounded-md border border-border px-4 py-2 text-sm font-medium text-cream transition-colors hover:bg-surface-hover"
        >
          Search {SITE_NAME}
        </Link>
      </div>
    </div>
  );
}
