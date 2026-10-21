"use client";

import Script from "next/script";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { EXOCLICK } from "@/lib/ads/exoclick";

/**
 * ExoclickVideoSlider — the floating video unit for zone 6049852.
 *
 * IMPORTANT: this zone is `zone_type: 31`, a VIDEO SLIDER, not an inline
 * display banner. ExoClick's ad-provider builds its own `position: fixed`
 * player with a close button and only pins `right: 0`, so the unit
 * anchors to the static position of the `<ins>` that requested it.
 *
 * That means placement is load-bearing. When the `<ins>` sat inside a
 * normal-flow wrapper (an inline banner slot below the hero), the slider
 * anchored there and rendered at y = -229 — above the viewport, i.e.
 * invisible, while the network happily logged "1 ad request completed".
 * The host below is therefore itself `fixed` to the bottom-right corner
 * and must not be wrapped in anything that establishes a containing
 * block (no transform, filter, or overflow clipping on an ancestor).
 *
 * One instance per document. The library has no dedupe of its own — a
 * second `<ins>` would request a second ad.
 *
 * Excluded on /watch: a floating video in the corner of a full-bleed
 * player is the single most hostile placement on the site, and that page
 * already serves an in-stream pre-roll. Browse pages get the slider;
 * the watch page gets the pre-roll.
 *
 * Session cap: 1 per 30 minutes. ExoClick also caps per-visitor on their
 * side (they set a zone-cap cookie), but showing it every page view is
 * how you lose the audience.
 */

const SESSION_TTL_MS = 30 * 60 * 1000;

function wasShownRecently(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const raw = window.localStorage.getItem(EXOCLICK.sliderShownKey);
    if (!raw) return false;
    const t = Number(raw);
    return Number.isFinite(t) && Date.now() - t < SESSION_TTL_MS;
  } catch {
    return false;
  }
}

export function ExoclickVideoSlider() {
  const [allowed, setAllowed] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    if (typeof window === "undefined") return;
    // No slider on the watch page — see the note above.
    if (pathname?.startsWith("/watch")) {
      setAllowed(false);
      return;
    }
    if (wasShownRecently()) return;
    try {
      window.localStorage.setItem(EXOCLICK.sliderShownKey, String(Date.now()));
    } catch {
      /* noop */
    }
    try {
      void fetch("/api/ads/impression", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ slot: "video-slider" }),
        keepalive: true,
      }).catch(() => {});
    } catch {
      /* noop */
    }
    setAllowed(true);
  }, [pathname]);

  if (!allowed) return null;

  return (
    // The host must stay a zero-footprint fixed anchor. Do not give it a
    // border, background, size, or an overflow value.
    <div
      aria-hidden="true"
      className="pointer-events-none fixed bottom-0 right-0 z-[9998]"
    >
      <Script
        id="exoclick-ad-provider"
        src={EXOCLICK.adProviderScriptUrl}
        type="application/javascript"
        strategy="afterInteractive"
      />
      <div className="pointer-events-auto">
        <ins
          className={EXOCLICK.sliderZoneClass}
          data-zoneid={EXOCLICK.sliderZoneId}
        />
      </div>
      <Script
        id={`exoclick-slider-${EXOCLICK.sliderZoneId}`}
        strategy="afterInteractive"
      >
        {/* String body, not an expression: an expression child is evaluated
            during prerender, where `window` does not exist. Safe today only
            because the `allowed` gate keeps this off SSR — don't rely on
            that if the gate is ever removed. */}
        {"(window.AdProvider = window.AdProvider || []).push({ serve: {} });"}
      </Script>
    </div>
  );
}