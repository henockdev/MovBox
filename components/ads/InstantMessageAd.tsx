"use client";

import Script from "next/script";
import { EXOCLICK } from "@/lib/ads/exoclick";
import { cn } from "@/lib/utils";

/**
 * InstantMessageAd — ExoClick native "instant message", zone 6057176.
 *
 * Same delivery as SponsoredRow and the video slider: the generic
 * `a.magsrv.com` ad-provider loader plus one <ins> carrying the zone class
 * and one AdProvider push. That is why this is cheap to add — the loader is
 * already on the page wherever SponsoredRow is mounted.
 *
 * WHY IT IS NOT JUST ANOTHER SponsoredRow
 *
 * SponsoredRow (zone 6054480) renders four cards in a row and is styled to
 * impersonate a real movie row. It needs a full row's worth of vertical space
 * and there are already six pages spending it. This zone renders a single
 * native message instead, so it fits where a four-card row would look
 * deliberate-but-overweight: the movie and TV detail pages, which currently
 * carry no native inventory at all.
 *
 * That placement is also the right commercial one. A detail page is the
 * deepest intent surface we have — someone is here because they intend to
 * watch something — and it is the last page before the player, so a native
 * unit there is competing for attention with content, not with nothing.
 *
 * The one thing NOT to do here is give it our own suppression cap. See the
 * note in SponsoredRow: the suppression key used to be written *before* the
 * ad was ever requested, so a no-fill or a blocked loader burned the slot
 * for the rest of the session while nothing had been shown. ExoClick caps
 * frequency on their side per zone; a second cap here only suppresses fill
 * we could have earned.
 */

interface InstantMessageAdProps {
  /** Extra classes for the wrapper. */
  className?: string;
  /** Skip rendering entirely. */
  hidden?: boolean;
}

export function InstantMessageAd({
  className,
  hidden = false,
}: InstantMessageAdProps) {
  if (hidden) return null;

  return (
    <aside
      className={cn("px-3 sm:px-5 md:px-6 lg:px-8", className)}
      aria-label="Sponsored recommendation"
    >
      <Script
        id="exoclick-ad-provider"
        src={EXOCLICK.adProviderScriptUrl}
        type="application/javascript"
        strategy="afterInteractive"
      />
      <ins
        className={EXOCLICK.instantMessageZoneClass}
        data-zoneid={EXOCLICK.instantMessageZoneId}
      />
      <Script
        id={`exoclick-instant-message-${EXOCLICK.instantMessageZoneId}`}
        strategy="afterInteractive"
      >
        {/* STRING child on purpose — see SponsoredRow. An expression child is
            evaluated during prerender, where `window` does not exist, which
            is a hard build-time crash ("window is not defined", exported from
            /_not-found). A string is only ever written into a <script> tag
            and only ever runs in the browser. */}
        {"(window.AdProvider = window.AdProvider || []).push({ serve: {} });"}
      </Script>
    </aside>
  );
}