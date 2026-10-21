/**
 * Central ad configuration for movbox.xyz.
 *
 * Everything the ad stack needs lives here. No component hard-codes a
 * publisher URL, zone ID, or host — they all read from this file. That is
 * the whole point: when a zone is reissued by the network, or a network is
 * removed, this is the only file that changes.
 *
 * NOT SECRETS. These are public publisher tags — anyone can read them off
 * the live page. They belong in source control, not environment variables.
 * The one env knob that does matter is the kill switch below.
 *
 * ---------------------------------------------------------------------------
 * Network A — HilltopAds
 * ---------------------------------------------------------------------------
 * Three formats, three delivery mechanisms:
 *   - Multi-tag banner / video slider: a self-injecting IIFE that finds its
 *     own <script> via document.currentScript and appends a second <script>.
 *     Loaded as an external src; we never need to replicate the wrapper.
 *   - Video (VAST): not a tag at all. A URL we fetch and parse, the same
 *     shape the previous provider used. See components/ads/VideoPreroll.tsx.
 *
 * NOTE: the dashboard listed each format as a *range* of 5 zones
 * (7538417-7538421 etc.) but issued ONE tag per format. That is how
 * HilltopAds' "MultiTag" products work — one tag, the network rotates
 * creatives/zones server-side. Do not invent per-zone URLs. If the network
 * later issues separate tags per zone, add them here explicitly.
 *
 * ---------------------------------------------------------------------------
 * Network B — Adsterra (profitableratecpmnetwork.com)
 * ---------------------------------------------------------------------------
 * Two plain script tags plus one smartlink (a destination URL, not a tag).
 */

import type { NetworkId } from "./types";

/**
 * Global kill switch. Set NEXT_PUBLIC_ADS_ENABLED=false in the Vercel env
 * and every unit below stops rendering on the next deploy — no code change,
 * no emergency branch. Useful when a network has an incident or an
 * advertiser complaint and you need the site ad-free in minutes.
 *
 * Default is ENABLED when the variable is absent, so a fresh deploy that
 * simply hasn't set it yet still shows ads.
 */
export function adsEnabled(): boolean {
  const raw = process.env.NEXT_PUBLIC_ADS_ENABLED;
  if (raw === undefined || raw === null || raw === "") return true;
  return raw !== "false" && raw !== "0";
}

export const ADSTERRA = {
  network: "adsterra" as const satisfies NetworkId,

  /**
   * Social bar — zone 31080288. A fixed bar rendered by the network at the
   * bottom of the viewport. We style it to match the site's dark theme in
   * components/ads/SiteAds.tsx; we do not control its contents.
   */
  socialBar: {
    zoneId: "31080288",
    scriptUrl:
      "https://pl31180787.profitableratecpmnetwork.com/4d/8e/8e/4d8e8e8c319c3cfa4ed4d9338662515f.js",
  },

  /**
   * Popunder — zone 31080286. Fires on user interaction (not on load) and
   * the network applies its own per-visitor cap. This is the only unit that
   * monetises a visitor who never plays anything.
   */
  popunder: {
    zoneId: "31080286",
    scriptUrl:
      "https://pl31180785.profitableratecpmnetwork.com/c8/63/1f/c8631f19a926b1ce86bd661e287e1538.js",
  },

  /**
   * Smartlink — zone 31080287. A destination URL, not a tag: it redirects
   * to the advertiser and records the click. Used as the call-to-action on
   * the /ad landing page (which is noindex and exists for exactly this).
   *
   * It is deliberately NOT used as an auto-redirect or as a fake button —
   * it is a labelled link the user chooses to click.
   */
  smartlink: {
    zoneId: "31080287",
    url: "https://www.profitableratecpmnetwork.com/yze0wqd6?key=f4fe1371dae7e93cde4f80cf5953c03f",
  },
} as const;

export const HILLTOP = {
  network: "hilltop" as const satisfies NetworkId,

  /**
   * Multi-tag banner — zones 7538401-7538405. A display unit. Mounted on the
   * detail pages inside a height-reserved slot so it cannot shift layout
   * (see components/ads/DisplayAd.tsx).
   */
  banner: {
    zoneId: "7538401",
    scriptUrl:
      "https://conventionalresponse.com/bvXEV/s.d/Gel-0qY/W/cb/pe/mI9DuCZeUrlwkTPTTMc/1SM-z/gE0AM/DYEhtCNmzqUkz/OwDOQkwnNEQN",
  },

  /**
   * Video slider — zones 7538385-7538389. A floating video unit.
   *
   * EXCLUDED FROM /watch. A floating video player in the corner of a
   * full-bleed player is the single most hostile placement on a streaming
   * site, and /watch already carries the pre-roll. Browse pages get this;
   * the watch page gets the pre-roll. (Same call the previous provider's
   * slider made, for the same reason.)
   */
  videoSlider: {
    zoneId: "7538385",
    scriptUrl:
      "https://conventionalresponse.com/baX_V.sndSGrlc0/YHWncX/Oenme9CuaZ/UFlUkLP/T/cE1mMNzng-zlOdDHUwt/NQzQUJznO/DCMZ4MO/Qz",
  },

  /**
   * Video / VAST — zones 7538417-7538421. A VAST tag endpoint, fetched and
   * parsed by our own component.
   *
   * Fetched with credentials so the network's own capping cookie
   * round-trips and their server-side cap actually applies.
   */
  vast: {
    zoneId: "7538417",
    tagUrl:
      "https://butterygrandmother.com/dlm.FazMd/GSNnvKZoGBUb/ueImh9/uAZPU_l/kvPOTdct1wMvzLgu0HMKTuc/tlN/zKUaz/OBD/Q/yGM/Qp",
  },
} as const;

/** Session throttle for the VAST pre-roll: one per session, per browser. */
export const PREROLL_SESSION_KEY = "movbox:ad:preroll:done:v2";

/**
 * Name of the window event that means "the viewer has genuinely asked to play".
 *
 * WHY A DOM EVENT INSTEAD OF A PROP OR CALLBACK
 * `Player.tsx` has a deliberately pinned hook count — see the note by its
 * early returns. Adding a `useState` for "show the preroll" there would
 * change the hook count and is exactly the change that previously crashed
 * the watch page for anyone on a cached chunk (React #310). So the player
 * publishes intent and the pre-roll subscribes, and Player gains zero hooks.
 *
 * It also keeps the concern honest: the player says "a real play was
 * requested" and knows nothing about advertising at all.
 */
export const PREROLL_TRIGGER_EVENT = "movbox:ad:preroll:trigger";

/**
 * Hard ceiling on the pre-roll, in seconds.
 *
 * The VAST document's own duration is whatever the network serves and can
 * change at any time. If a creative ever ships longer than this we still
 * hand control back at the ceiling rather than making the viewer sit through
 * it. The user's play action is never held hostage to a third party's
 * creative length.
 */
export const PREROLL_MAX_S = 30;

/** Fallback skip offset if the VAST document carries no <Linear skipoffset>. */
export const PREROLL_DEFAULT_SKIP_S = 5;

/** Absolute budget for the whole pre-roll: fetch + parse + first frame. */
export const PREROLL_FETCH_TIMEOUT_MS = 3000;