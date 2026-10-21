/**
 * ExoClick ad configuration for movbox.xyz.
 *
 * ExoClick is a VAST-first network. Unlike the previous provider we do
 * NOT load a JavaScript tag library and call `run*()` helpers — we fetch
 * the VAST XML ourselves and drive the ad from our own player component.
 * That means:
 *   - No third-party <script> on every page (nothing to block first paint).
 *   - No global `window.*` shim to declare or clean up.
 *   - Full control over when the ad plays and how it is skipped.
 *
 * Two formats are wired up:
 *   - In-stream pre-roll (VAST) — parsed and played by our own player
 *     component. No third-party script involved at all.
 *   - Display banner — uses ExoClick's generic ad-provider loader,
 *     mounted once per document via components/ads/ExoclickBanner.tsx.
 *
 * If a push/popunder zone is ever approved, add it here — but do NOT
 * reintroduce a site-wide auto-tag loader. One banner plus one pre-roll
 * is the whole ad load, and that is deliberate: it keeps the watch page
 * free of anything that could interfere with the video element.
 */

/** Zone identifiers handed out by the ExoClick dashboard. */
export const EXOCLICK = {
  /**
   * In-stream video pre-roll zone. We fetch the VAST tag below, parse
   * the <MediaFile> we can play, run it full-bleed over the player, then
   * hand control back. See components/ads/PrerollAd.tsx.
   */
  inStreamZoneId: "6049850",

  /**
   * VAST tag endpoint. Returns VAST 3.0 <InLine> (no wrapper redirect),
   * a single progressive MP4, ~12s duration with a 5s skip offset.
   *
   * The response is *dynamic* — every fetch returns fresh tracker URLs
   * and a fresh creative. Do not cache it.
   */
  inStreamVastUrl: "https://s.magsrv.com/v1/vast.php?idz=6049850",

  /**
   * VIDEO SLIDER zone (ExoClick `zone_type: 31`) — NOT an inline display
   * banner. Confirmed from the provider's own console output:
   *   "Request #0 with 1 zone(s) of type VIDEO SLIDER is being served."
   *
   * ad-provider.js builds a `position: fixed` player with its own close
   * button and only pins `right: 0`, so it anchors to the static position
   * of the requesting `<ins>`. See ExoclickVideoSlider.tsx for why that
   * makes placement load-bearing.
   */
  sliderZoneId: "6049852",
  sliderZoneClass: "eas6a97888e31",

  /** Generic loader used by the slider zone. Async, never blocks paint. */
  adProviderScriptUrl: "https://a.magsrv.com/ad-provider.js",

  /** localStorage key holding the timestamp we last showed the slider. */
  sliderShownKey: "movbox:ad:slider:done",

  /**
   * NATIVE / recommendation widget zone — a row of 4 sponsored cards that we
   * render as a movie row so it is indistinguishable from real content.
   * Verified against the live zone: it renders `.msg-native-widget` markup.
   *
   * Themed by components/ads/SponsoredRow.tsx + lib/ads/sponsoredRowCss.ts,
   * which MUST anchor on the `#movbox-sponsored-ads` wrapper that component
   * renders. See the note in that component before renaming anything.
   */
  nativeZoneId: "6053376",
  nativeZoneClass: "eas6a97888e2",

  /**
   * RECOMMENDATION WIDGET — Grid (4x1). The card-format inventory the whole
   * in-feed native strategy is built on: four cards that sit in a row and
   * can be styled to match MovieCard exactly.
   *
   * Zone 6054480 is the primary. 6053382 is a second, identical Grid (4x1)
   * kept as a rotation/A-B slot so we are not dependent on one zone's fill.
   *
   * Measured on the live zones: 6054480 and 6053382 both fill with 4 items;
   * 6053376 is a 300x250 Banner that happens to also emit 4 items.
   */
  widgetZoneId: "6054480",
  widgetZoneClass: "eas6a97888e20",
  widgetZoneAltId: "6053382",

  /**
   * OUT-STREAM video zone (class `eas6a97888e37`). Renders as a playable
   * video unit that the player hands control to when the viewer pauses —
   * a pause is a natural, low-friction moment to show a video ad.
   */
  outStreamZoneId: "6054510",
  outStreamZoneClass: "eas6a97888e37",

  /**
   * INSTANT MESSAGE — native unit (dashboard: "instant message").
   *
   * Uses the same generic `ad-provider.js` loader as the slider and the
   * sponsored grid, so it is wired exactly like SponsoredRow: an <ins>
   * carrying the zone class, then one AdProvider push. It renders as a
   * single native message card rather than a four-card row, so it goes on
   * pages that have no room for a full row (detail pages) instead of
   * crowding the browse rows that already carry SponsoredRow.
   */
  instantMessageZoneId: "6057176",
  instantMessageZoneClass: "eas6a97888e6",

  /**
   * POPUNDER — zone 6057172.
   *
   * DIFFERENT DELIVERY MECHANISM from every other zone here. The slider,
   * grid and instant message all use the `a.magsrv.com` ad-provider loader.
   * The popunder does not: it is a self-contained IIFE (popMagic v12) that
   * carries its own `adConfig` and talks to `a.pemsrv.com` /
   * `s.pemsrv.com` directly. That is why the dashboard hands over a raw
   * inline <script> rather than an <ins> tag.
   *
   * The vendor blob is ~16KB of minified, obfuscated third-party code and
   * cannot be pasted into a JSX string body without escaping hazards, so it
   * is shipped verbatim as a static asset at /popunder-6057172.js and
   * loaded via <Script src>. It must stay byte-identical to what the
   * dashboard issued — do not reformat or "tidy" it. Regenerate it from the
   * dashboard snippet if the zone is ever reissued.
   */
  popunderZoneId: "6057172",
  popunderScriptSrc: "/popunder-6057172.js",

  /**
   * Popunder delivery settings, mirrored from the dashboard's adConfig for
   * documentation. They live in the vendor blob itself — this is a record of
   * what we asked for, not a second source of truth. If one of these needs to
   * change, change it in the dashboard and re-copy the snippet.
   *
   *   frequency_period 60 / frequency_count 1
   *       One popunder per 60 minutes per visitor, enforced by them via
   *       cookie. We do not add a second cap of our own — two caps on one
   *       format means neither is the one actually governing.
   *   trigger_method 3
   *       Their engagement trigger (user interaction), not an onload popup.
   *   capping_enabled true
   *   tcf_enabled true
   *       EU consent handling is on. Leave it on.
   *   agego_cross_site_enabled true
   *       Enables their cross-site age-gate redirect flow.
   */
  popunderFrequencyMinutes: 60,

  /** localStorage key holding the timestamp we last showed the native grid. */
  nativeShownKey: "movbox:ad:native:done",

  /**
   * Domain-verification token. Served as a bare file from
   * public/031ad9ce8395a62fcb614b9fd7410dcd.html so the ExoClick
   * dashboard can fetch it from the site root and confirm ownership.
   */
  verificationToken: "031ad9ce8395a62fcb614b9fd7410dcd",
} as const;

/**
 * Fire a VAST tracker URL.
 *
 * Trackers are cross-origin pixel/beacon URLs and return nothing useful,
 * so we never care about the result. `sendBeacon` is preferred because
 * it survives the page going away mid-request (common on a pre-roll when
 * the user skips); we fall back to a keepalive fetch and finally to a
 * plain pixel so the beacon is never silently dropped.
 */
export function track(url: string): void {
  if (typeof window === "undefined" || !url) return;

  if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
    try {
      // The empty Blob gives the request a body without setting a
      // content-type, so this stays a simple CORS request instead of
      // triggering a preflight we don't need to answer.
      if (navigator.sendBeacon(url, new Blob([]))) return;
    } catch {
      /* fall through to fetch */
    }
  }

  try {
    void fetch(url, { credentials: "omit", keepalive: true, mode: "no-cors" }).catch(
      () => {},
    );
    return;
  } catch {
    /* fall through to pixel */
  }

  // Last resort. Intentionally swallowing the failure — this must never
  // interrupt playback.
  const img = new Image(1);
  img.src = url;
}