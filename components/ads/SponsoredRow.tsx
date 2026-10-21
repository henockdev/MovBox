"use client";

import Script from "next/script";
import { EXOCLICK } from "@/lib/ads/exoclick";
import { SPONSORED_ROW_CSS } from "@/lib/ads/sponsoredRowCss";
import { cn } from "@/lib/utils";

/**
 * SponsoredRow — sponsored cards rendered as a movie row.
 *
 * THE STRATEGY
 * A boxed 300x250 between rows reads as an ad and gets ignored (or
 * annoys). The same creative sitting in the position of a movie card,
 * at the same size, with the same hover lift, is what actually gets
 * clicked. So this deliberately mirrors MovieRow/MovieCard geometry
 * exactly rather than looking like a banner.
 *
 * IMPORTANT: the id on the wrapper is load-bearing, not cosmetic.
 * lib/ads/sponsoredRowCss.ts anchors on `#movbox-sponsored-ads` and is
 * injected as a <style> element in the body so it beats ExoClick's own
 * runtime-injected `!important` rules on source order. Renaming the id
 * silently reverts the theming. Read the comment at the top of
 * sponsoredRowCss.ts before touching it.
 *
 * FREQUENCY: uncapped, and deliberately so. One four-card row per page,
 * below the fold, styled as content, is not a thing a visitor notices
 * twice. The intrusive formats are the ones that need capping — the
 * floating video slider keeps a 30-minute TTL in ExoclickVideoSlider.tsx.
 *
 * It used to be capped, and that was actively costing us impressions:
 * the suppression key was written before the ad was ever requested, so a
 * no-fill or a blocked loader burned the slot for the rest of the
 * session while nothing had been shown.
 */

interface SponsoredRowProps {
  /** Row heading. Defaults to something that does not read as an ad. */
  title?: string;
  className?: string;
  /** Skip on the watch page — the player owns that screen. */
  hidden?: boolean;
}

export function SponsoredRow({
  title = "You might also like",
  className,
  hidden = false,
}: SponsoredRowProps) {
  if (hidden) return null;

  return (
    <section className={cn("relative group/row", className)}>
      <header className="mb-2.5 flex items-end justify-between gap-3 px-3 sm:mb-3 sm:px-5 md:px-6 lg:px-8">
        <h2 className="flex items-center gap-2 font-display text-base font-bold text-cream sm:text-lg md:text-xl">
          <span>{title}</span>
        </h2>
        {/* Disclosure. Required, and the row reads as a normal row with it. */}
        <span className="rounded border border-border px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-[0.16em] text-text-muted">
          Sponsored
        </span>
      </header>

      <div className="relative">
        <div
          id="movbox-sponsored-ads"
          className="px-3 sm:px-5 md:px-6 lg:px-8"
          aria-label="Sponsored recommendations"
        >
          <Script
            id="exoclick-ad-provider"
            src={EXOCLICK.adProviderScriptUrl}
            type="application/javascript"
            strategy="afterInteractive"
          />
          <ins
            className={EXOCLICK.widgetZoneClass}
            data-zoneid={EXOCLICK.widgetZoneId}
          />
          <Script
            id={`exoclick-sponsored-${EXOCLICK.widgetZoneId}`}
            strategy="afterInteractive"
          >
            {/* Body is a STRING on purpose. An expression child gets
                evaluated during prerender, where `window` does not exist —
                that is a build-time crash ("window is not defined",
                exported from /_not-found). A string is only ever written
                into a <script> tag, and only ever runs in the browser. */}
            {"(window.AdProvider = window.AdProvider || []).push({ serve: {} });"}
          </Script>

          {/* Injected AFTER the markup on purpose — see sponsoredRowCss.ts. */}
          <style dangerouslySetInnerHTML={{ __html: SPONSORED_ROW_CSS }} />
        </div>
      </div>
    </section>
  );
}