"use client";

import Script from "next/script";
import { usePathname } from "next/navigation";
import { EXOCLICK } from "@/lib/ads/exoclick";

/**
 * ExoclickOutStream — ExoClick "Out Stream" zone 6054510.
 *
 * An out-stream unit is a video ad that WE decide when to show, in a
 * container WE own, rather than one that fires on page load. A pause is
 * the right trigger: the viewer has stopped, nothing is competing for
 * their attention, and resuming playback takes one tap. That is a far
 * cheaper ask than a pre-roll, which interrupts the reason they came.
 *
 * It is mounted on every page but only ever arms on /watch, because that
 * is the only screen with a player to pause.
 *
 * Frequency: one per 10 minutes of watching. Out-stream earns well
 * precisely because it is low-pressure; showing it every pause is how you
 * turn that into the thing people close the tab over.
 */

const COOLDOWN_MS = 10 * 60 * 1000;
const SHOWN_KEY = "movbox:ad:outstream:done";
const HOST_ID = "movbox-outstream";

/**
 * Ask for an out-stream ad. Called from the player's pause handler.
 *
 * No-ops on any page without a player, and within the cooldown window.
 * Kept as a module function (not a prop) so Player can call it without
 * taking a new prop or adding a hook to itself.
 */
export function requestOutStreamAd(): void {
  if (typeof window === "undefined") return;
  if (!window.location.pathname.startsWith("/watch")) return;

  try {
    const raw = window.localStorage.getItem(SHOWN_KEY);
    if (raw) {
      const t = Number(raw);
      if (Number.isFinite(t) && Date.now() - t < COOLDOWN_MS) return;
    }
    window.localStorage.setItem(SHOWN_KEY, String(Date.now()));
  } catch {
    /* storage blocked — still allow the ad, just uncapped */
  }

  const host = document.getElementById(HOST_ID);
  if (host) host.classList.remove("hidden");

  try {
    // String body: an expression child is evaluated during prerender,
    // where `window` does not exist and the build fails.
    const w = window as unknown as { AdProvider?: unknown[] };
    (w.AdProvider = w.AdProvider || []).push({ serve: {} });
  } catch {
    /* noop */
  }
}

export function ExoclickOutStream() {
  const pathname = usePathname();
  const onWatch = Boolean(pathname?.startsWith("/watch"));

  return (
    <>
      <Script
        id="exoclick-ad-provider"
        src={EXOCLICK.adProviderScriptUrl}
        type="application/javascript"
        strategy="afterInteractive"
      />
      {/* Mounted with the zone but never auto-served: ExoClick only fills
          the unit once something pushes a serve for it, which is exactly
          what requestOutStreamAd() does on pause. The unit starts hidden
          and is revealed by that same call.

          No custom close button — ExoClick's out-stream unit renders its
          own. Adding a second one meant a control that was permanently
          display:none, which is worse than no control at all. */}
      <ins
        id={HOST_ID}
        className={`${EXOCLICK.outStreamZoneClass} ${onWatch ? "" : "hidden"}`}
        data-zoneid={EXOCLICK.outStreamZoneId}
      />
    </>
  );
}