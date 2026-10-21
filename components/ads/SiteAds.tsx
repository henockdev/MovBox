"use client";

import { usePathname } from "next/navigation";
import { AdScript } from "./AdScript";
import { ADSTERRA, HILLTOP, adsEnabled } from "@/lib/ads/config";

/**
 * SiteAds — the ad units that live on every route.
 *
 * PLACEMENT MATRIX (deliberate, not "ads everywhere")
 *
 *   Unit                    Network    Routes            Why here
 *   ---------------------------------------------------------------------
 *   Popunder                Adsterra   all (incl. /watch) Only unit that earns
 *                                                     from a visitor who never
 *                                                     plays anything. Fires on
 *                                                     user interaction, not load.
 *   Social bar              Adsterra   all               Fixed strip; network-capped.
 *                                                     Cannot interrupt playback
 *                                                     because it is not modal.
 *   Video slider            Hilltop    browse routes only EXCLUDED from /watch: a
 *                                                     floating video in the corner
 *                                                     of a full-bleed player is the
 *                                                     most hostile placement on the
 *                                                     site, and /watch already runs
 *                                                     the pre-roll. Excluded from
 *                                                     detail pages too — they carry
 *                                                     the banner, and stacking two
 *                                                     units on one screen is how you
 *                                                     get a reader bounce.
 *
 * /watch therefore gets exactly ONE ad surface: the VAST pre-roll, which is
 * mounted by the player itself (components/ads/VideoPreroll.tsx).
 *
 * Mobile note: the Adsterra social bar anchors to the bottom of the viewport
 * and the primary nav is also fixed to the bottom. They collide by default.
 * globals.css reserves space for it via `--movbox-socialbar-h`; that value is
 * verified against the live unit and documented there. Do not stack a third
 * fixed element without re-checking it.
 */

export function SiteAds() {
  const pathname = usePathname();
  const enabled = adsEnabled();

  if (!enabled) return null;

  const onWatch = Boolean(pathname?.startsWith("/watch"));
  const onDetail =
    pathname?.startsWith("/movie/") === true ||
    pathname?.startsWith("/tv/") === true;

  return (
    <>
      {/* Adsterra — popunder. Engagement-triggered and network-capped, so it
          cannot ambush someone at the moment they press play. */}
      <AdScript
        id="movbox-adsterra-popunder"
        src={ADSTERRA.popunder.scriptUrl}
      />

      {/* Adsterra — social bar. */}
      <AdScript
        id="movbox-adsterra-socialbar"
        src={ADSTERRA.socialBar.scriptUrl}
      />

      {/* Hilltop — floating video slider. Browse surfaces only. */}
      <AdScript
        id="movbox-hilltop-videoslider"
        src={HILLTOP.videoSlider.scriptUrl}
        enabled={!onWatch && !onDetail}
      />
    </>
  );
}