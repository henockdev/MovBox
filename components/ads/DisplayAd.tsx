"use client";

import { AdScript } from "./AdScript";
import { HILLTOP, adsEnabled } from "@/lib/ads/config";

/**
 * DisplayAd — HilltopAds multi-tag banner, used on the detail pages.
 *
 * WHY THE DETAIL PAGES
 * A detail page is the deepest-intent surface on the site — someone is here
 * because they intend to watch something. It is also the last page before the
 * player, so a single well-placed unit earns without crowding the decision the
 * visitor is actually making. These pages previously carried an instant-message
 * unit; the banner takes that slot.
 *
 * CLS PROTECTION
 * Third-party display units do whatever size their network wants, and they do
 * it after paint. That is a direct Cumulative Layout Shift hit on a page that
 * otherwise doesn't move. So the slot is a fixed, reserved height and the
 * container never reflows when the creative arrives. If a creative comes back
 * taller than the reservation, `overflow: hidden` clips it rather than letting
 * it push the page around.
 *
 * The height is a layout decision, not publisher data — it is ours to choose,
 * and it is documented here so it can be tuned in one place.
 */
export function DisplayAd({ className }: { className?: string }) {
  if (!adsEnabled()) return null;

  return (
    <aside
      className={className}
      aria-label="Advertisement"
      // Reserved slot: fixed height, no reflow when the creative loads.
      style={{ minHeight: "250px" }}
    >
      <div
        className="flex w-full items-center justify-center overflow-hidden"
        style={{ height: "250px" }}
      >
        <AdScript
          id="movbox-hilltop-banner"
          src={HILLTOP.banner.scriptUrl}
        />
      </div>
    </aside>
  );
}